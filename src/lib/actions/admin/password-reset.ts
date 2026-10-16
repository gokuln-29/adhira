"use server";

import { after } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { admin_password_resets, admin_users, toMysqlDatetime } from "@/lib/db/schema";
import { newId } from "@/lib/db/helpers";
import { authorize } from "@/lib/admin/auth";
import { revokeAdminSessions } from "@/lib/auth/admin-session";
import { randomToken, sha256 } from "@/lib/auth/crypto";
import { consumeMfaCode } from "@/lib/auth/mfa";
import { assertSameOrigin } from "@/lib/auth/origin";
import { hashPassword, passwordProblem } from "@/lib/auth/password";
import { sendPasswordChangedNotice, sendPasswordResetEmail } from "@/lib/notify/admin-emails";
import { hitRateLimit, withinRateLimit } from "@/lib/security/rate-limit";
import { SITE_URL } from "@/lib/seo/site";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const RESET_TTL_MIN = 30;
const emailSchema = z.string().trim().toLowerCase().email().max(255);

async function createResetLink(adminId: string): Promise<string> {
  const token = randomToken(32);
  // Only the newest link works: drop earlier unused ones.
  await db.delete(admin_password_resets).where(and(eq(admin_password_resets.admin_id, adminId), isNull(admin_password_resets.used_at)));
  await db.insert(admin_password_resets).values({
    id: newId(),
    admin_id: adminId,
    token_hash: sha256(token),
    expires_at: new Date(Date.now() + RESET_TTL_MIN * 60_000).toISOString(),
  });
  return `${SITE_URL}/admin/reset-password?token=${token}`;
}

// "Forgot password": always the same answer, whether or not the address belongs to
// an admin, so the form can't be used to discover staff emails.
export async function requestAdminPasswordReset(rawEmail: string): Promise<Result> {
  if (!(await assertSameOrigin())) return { ok: false, error: "Request blocked." };
  const email = emailSchema.safeParse(rawEmail);
  if (!email.success) return { ok: false, error: "Enter a valid email address." };
  if (!(await withinRateLimit("admin-reset-request", 10, 600)) || !(await hitRateLimit(`admin-reset-email:${email.data}`, 3, 3600))) {
    return { ok: false, error: "Too many requests. Please wait a while and try again." };
  }

  const rows = await db.select().from(admin_users).where(eq(admin_users.email, email.data)).limit(1);
  const admin = rows[0];
  if (admin) {
    const link = await createResetLink(admin.id);
    // After the response, so timing doesn't reveal whether the account exists.
    after(() => sendPasswordResetEmail(admin.email, admin.name, link, RESET_TTL_MIN));
  }
  return { ok: true };
}

// Owner sends a reset link to a colleague (forgotten password, new starter).
export async function sendStaffPasswordReset(adminId: string): Promise<Result> {
  const auth = await authorize("ownerOnly");
  if (!auth.ok) return auth;
  if (!(await hitRateLimit(`admin-reset-owner:${auth.admin.id}`, 20, 3600))) {
    return { ok: false, error: "Too many requests. Please wait a while." };
  }
  const rows = await db.select().from(admin_users).where(eq(admin_users.id, adminId)).limit(1);
  const admin = rows[0];
  if (!admin) return { ok: false, error: "Staff member not found." };
  const link = await createResetLink(admin.id);
  after(() => sendPasswordResetEmail(admin.email, admin.name, link, RESET_TTL_MIN));
  return { ok: true };
}

async function findLiveReset(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const rows = await db
    .select({
      resetId: admin_password_resets.id,
      admin: admin_users,
    })
    .from(admin_password_resets)
    .innerJoin(admin_users, eq(admin_password_resets.admin_id, admin_users.id))
    .where(
      and(
        eq(admin_password_resets.token_hash, sha256(token)),
        isNull(admin_password_resets.used_at),
        gt(admin_password_resets.expires_at, toMysqlDatetime(new Date())),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

// Lets the page show the right form (and a clear message for dead links).
export async function checkAdminResetToken(token: string): Promise<{ valid: boolean; needsMfa: boolean }> {
  if (!(await withinRateLimit("admin-reset-check", 60, 600))) return { valid: false, needsMfa: false };
  const live = await findLiveReset(token);
  return { valid: !!live, needsMfa: !!live?.admin.totp_enabled };
}

const completeSchema = z.object({
  token: z.string().max(100),
  password: z.string().max(200),
  mfaCode: z.string().trim().max(20).optional(),
});

export async function completeAdminPasswordReset(raw: { token: string; password: string; mfaCode?: string }): Promise<Result> {
  if (!(await assertSameOrigin())) return { ok: false, error: "Request blocked." };
  const parsed = completeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "This link is no longer valid." };
  const { token, password, mfaCode } = parsed.data;
  if (!(await withinRateLimit("admin-reset-complete", 20, 600))) {
    return { ok: false, error: "Too many attempts. Please wait a few minutes." };
  }
  // Caps guessing of the authenticator code for one specific link.
  if (!(await hitRateLimit(`admin-reset-token:${sha256(token)}`, 8, 600))) {
    return { ok: false, error: "Too many attempts on this link. Request a new one." };
  }

  const live = await findLiveReset(token);
  if (!live) return { ok: false, error: "This link has expired or was already used. Request a new one." };
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem };

  // A mailbox alone must not be enough to take over an account that has two-factor on.
  if (live.admin.totp_enabled) {
    if (!mfaCode || !(await consumeMfaCode(live.admin, mfaCode))) {
      return { ok: false, error: "Enter a valid authenticator or recovery code." };
    }
  }

  const passwordHash = await hashPassword(password);
  const changed = await db.transaction(async (tx) => {
    // Single use, even if two requests race: only one UPDATE can flip used_at.
    const [mark] = await tx
      .update(admin_password_resets)
      .set({ used_at: new Date().toISOString() })
      .where(and(eq(admin_password_resets.id, live.resetId), isNull(admin_password_resets.used_at)));
    if (mark.affectedRows !== 1) return false;
    await tx
      .update(admin_users)
      .set({ password_hash: passwordHash, failed_logins: 0, locked_until: null })
      .where(eq(admin_users.id, live.admin.id));
    return true;
  });
  if (!changed) return { ok: false, error: "This link has expired or was already used. Request a new one." };

  // Whoever had a session (including an attacker) is signed out everywhere.
  await revokeAdminSessions(live.admin.id);
  after(() => sendPasswordChangedNotice(live.admin.email, live.admin.name));
  return { ok: true };
}
