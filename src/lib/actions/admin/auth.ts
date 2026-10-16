"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { admin_users } from "@/lib/db/schema";
import {
  createAdminSession,
  destroyAdminSession,
  readAdminSession,
  revokeAdminSessions,
  rotateAdminSession,
} from "@/lib/auth/admin-session";
import { decryptAtRest, encryptAtRest, hmac, randomToken } from "@/lib/auth/crypto";
import { consumeMfaCode } from "@/lib/auth/mfa";
import { assertSameOrigin } from "@/lib/auth/origin";
import { burnPasswordCheck, hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { generateTotpSecret, otpauthUri, verifyTotp } from "@/lib/auth/totp";
import { hitRateLimit, withinRateLimit } from "@/lib/security/rate-limit";
import { SITE_NAME } from "@/lib/seo/site";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const GENERIC = "Incorrect email or password.";

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(255), password: z.string().min(1).max(200) });

export async function adminLogin(raw: { email: string; password: string }): Promise<Result<{ needsMfa: boolean }>> {
  if (!(await assertSameOrigin())) return { ok: false, error: "Request blocked." };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: GENERIC };
  const { email, password } = parsed.data;

  // Per-IP and per-account throttles (the lockout below also caps guessing).
  if (!(await withinRateLimit("admin-login", 20, 600)) || !(await hitRateLimit(`admin-login-email:${email}`, 15, 600))) {
    return { ok: false, error: "Too many attempts. Please wait a few minutes." };
  }

  const rows = await db.select().from(admin_users).where(eq(admin_users.email, email)).limit(1);
  const admin = rows[0];
  if (!admin) {
    await burnPasswordCheck(password);
    return { ok: false, error: GENERIC };
  }
  if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
    await burnPasswordCheck(password);
    return { ok: false, error: "Too many attempts. Please wait a few minutes." };
  }

  if (!(await verifyPassword(admin.password_hash, password))) {
    const failed = admin.failed_logins + 1;
    await db
      .update(admin_users)
      .set(
        failed >= MAX_FAILED
          ? { failed_logins: 0, locked_until: new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() }
          : { failed_logins: failed },
      )
      .where(eq(admin_users.id, admin.id));
    return { ok: false, error: GENERIC };
  }

  await db.update(admin_users).set({ failed_logins: 0, locked_until: null }).where(eq(admin_users.id, admin.id));
  // New random token on every login (no session fixation); MFA pending until verified.
  await createAdminSession(admin.id, !admin.totp_enabled);
  return { ok: true, needsMfa: admin.totp_enabled };
}

const codeSchema = z.string().trim().min(6).max(20);

// Second step: a 6-digit authenticator code, or a one-time recovery code.
export async function adminVerifyMfa(rawCode: string): Promise<Result> {
  if (!(await assertSameOrigin())) return { ok: false, error: "Request blocked." };
  const session = await readAdminSession();
  if (!session || session.mfaPassed) return { ok: false, error: "Please sign in again." };
  if (!(await hitRateLimit(`admin-mfa:${session.admin.id}`, 8, 600))) {
    return { ok: false, error: "Too many attempts. Please wait a few minutes." };
  }
  const code = codeSchema.safeParse(rawCode);
  if (!code.success) return { ok: false, error: "Invalid code." };

  const rows = await db.select().from(admin_users).where(eq(admin_users.id, session.admin.id)).limit(1);
  const admin = rows[0];
  if (!admin?.totp_secret) return { ok: false, error: "Please sign in again." };

  if (!(await consumeMfaCode(admin, code.data))) return { ok: false, error: "Invalid code." };

  await rotateAdminSession(session.sessionId, true);
  return { ok: true };
}

export async function adminLogout(): Promise<void> {
  if (!(await assertSameOrigin())) return;
  await destroyAdminSession();
}

// ---- MFA enrollment (any signed-in admin, for their own account) -----------

export async function beginMfaEnrollment(): Promise<Result<{ secret: string; uri: string }>> {
  if (!(await assertSameOrigin())) return { ok: false, error: "Request blocked." };
  const session = await readAdminSession();
  if (!session?.mfaPassed) return { ok: false, error: "Please sign in again." };
  if (session.admin.totp_enabled) return { ok: false, error: "Two-factor authentication is already on." };

  const secret = generateTotpSecret();
  await db.update(admin_users).set({ totp_secret: encryptAtRest(secret) }).where(eq(admin_users.id, session.admin.id));
  return { ok: true, secret, uri: otpauthUri(secret, session.admin.email, SITE_NAME) };
}

export async function confirmMfaEnrollment(rawCode: string): Promise<Result<{ recoveryCodes: string[] }>> {
  if (!(await assertSameOrigin())) return { ok: false, error: "Request blocked." };
  const session = await readAdminSession();
  if (!session?.mfaPassed) return { ok: false, error: "Please sign in again." };
  if (!(await hitRateLimit(`admin-mfa:${session.admin.id}`, 8, 600))) {
    return { ok: false, error: "Too many attempts. Please wait a few minutes." };
  }

  const rows = await db.select().from(admin_users).where(eq(admin_users.id, session.admin.id)).limit(1);
  const admin = rows[0];
  if (!admin?.totp_secret || admin.totp_enabled) return { ok: false, error: "Start setup again." };
  const step = verifyTotp(decryptAtRest(admin.totp_secret), String(rawCode).trim(), null);
  if (step == null) return { ok: false, error: "That code didn't match. Try the next one." };

  const plain = Array.from({ length: 8 }, () => randomToken(5).toLowerCase().replace(/[^a-z0-9]/g, "x").slice(0, 8));
  await db
    .update(admin_users)
    .set({
      totp_enabled: true,
      totp_last_step: step,
      recovery_codes: plain.map((c) => hmac(`recovery:${c}`)),
    })
    .where(eq(admin_users.id, admin.id));
  await rotateAdminSession(session.sessionId, true);
  return { ok: true, recoveryCodes: plain };
}

export async function changeOwnPassword(input: { current: string; next: string }): Promise<Result> {
  if (!(await assertSameOrigin())) return { ok: false, error: "Request blocked." };
  const session = await readAdminSession();
  if (!session?.mfaPassed) return { ok: false, error: "Please sign in again." };
  const problem = passwordProblem(input.next);
  if (problem) return { ok: false, error: problem };
  if (!(await hitRateLimit(`admin-pw:${session.admin.id}`, 8, 600))) {
    return { ok: false, error: "Too many attempts. Please wait a few minutes." };
  }

  const rows = await db.select().from(admin_users).where(and(eq(admin_users.id, session.admin.id))).limit(1);
  if (!rows[0] || !(await verifyPassword(rows[0].password_hash, input.current))) {
    return { ok: false, error: "Your current password is incorrect." };
  }
  await db.update(admin_users).set({ password_hash: await hashPassword(input.next) }).where(eq(admin_users.id, session.admin.id));
  // Rotate this session and sign out everywhere else.
  await rotateAdminSession(session.sessionId);
  await revokeAdminSessions(session.admin.id, session.sessionId);
  return { ok: true };
}

