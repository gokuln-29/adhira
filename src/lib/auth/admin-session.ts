import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { and, eq, gt, lt, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { admin_sessions, admin_users } from "@/lib/db/schema";
import { newId } from "@/lib/db/helpers";
import { toMysqlDatetime } from "@/lib/db/schema";
import { randomToken, sha256 } from "@/lib/auth/crypto";
import { ADMIN_COOKIE, cookieOptions } from "@/lib/auth/cookies";
import type { AdminUser } from "@/lib/admin/roles";

const ABSOLUTE_SECONDS = 7 * 24 * 3600; // hard cap, re-login weekly
const IDLE_SECONDS = 12 * 3600; // sliding idle timeout
const TOUCH_EVERY_MS = 5 * 60 * 1000;

const iso = (msFromNow = 0) => new Date(Date.now() + msFromNow).toISOString();

async function clientMeta() {
  const h = await headers();
  return {
    ip: (h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "").slice(0, 64) || null,
    user_agent: (h.get("user-agent") || "").slice(0, 255) || null,
  };
}

/** Creates a session (new random token) and sets the cookie. Server actions / route handlers only. */
export async function createAdminSession(adminId: string, mfaPassed: boolean): Promise<void> {
  const token = randomToken();
  await db.insert(admin_sessions).values({
    id: newId(),
    admin_id: adminId,
    token_hash: sha256(token),
    mfa_passed: mfaPassed,
    ...(await clientMeta()),
    expires_at: iso(ABSOLUTE_SECONDS * 1000),
  });
  (await cookies()).set(ADMIN_COOKIE, token, cookieOptions(ABSOLUTE_SECONDS, "strict"));
}

export interface AdminSession {
  sessionId: string;
  admin: AdminUser & { email: string; totp_enabled: boolean };
  mfaPassed: boolean;
}

// Deduped per request: layout, page and actions all ask who the admin is.
export const readAdminSession = cache(async (): Promise<AdminSession | null> => {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({
      sessionId: admin_sessions.id,
      mfaPassed: admin_sessions.mfa_passed,
      lastSeen: admin_sessions.last_seen_at,
      id: admin_users.id,
      name: admin_users.name,
      email: admin_users.email,
      role: admin_users.role,
      totp_enabled: admin_users.totp_enabled,
    })
    .from(admin_sessions)
    .innerJoin(admin_users, eq(admin_sessions.admin_id, admin_users.id))
    .where(and(eq(admin_sessions.token_hash, sha256(token)), gt(admin_sessions.expires_at, toMysqlDatetime(iso()))))
    .limit(1);
  const r = rows[0];
  if (!r) return null;

  const idleFor = Date.now() - new Date(r.lastSeen).getTime();
  if (idleFor > IDLE_SECONDS * 1000) {
    await db.delete(admin_sessions).where(eq(admin_sessions.id, r.sessionId));
    return null;
  }
  if (idleFor > TOUCH_EVERY_MS) {
    await db.update(admin_sessions).set({ last_seen_at: iso() }).where(eq(admin_sessions.id, r.sessionId));
  }

  return {
    sessionId: r.sessionId,
    mfaPassed: r.mfaPassed,
    admin: { id: r.id, name: r.name, email: r.email, role: r.role, totp_enabled: r.totp_enabled },
  };
});

/** Issue a fresh token for an existing session (privilege change: MFA passed, password changed). */
export async function rotateAdminSession(sessionId: string, mfaPassed?: boolean): Promise<void> {
  const token = randomToken();
  await db
    .update(admin_sessions)
    .set({
      token_hash: sha256(token),
      last_seen_at: iso(),
      ...(mfaPassed === undefined ? {} : { mfa_passed: mfaPassed }),
    })
    .where(eq(admin_sessions.id, sessionId));
  (await cookies()).set(ADMIN_COOKIE, token, cookieOptions(ABSOLUTE_SECONDS, "strict"));
}

export async function destroyAdminSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (token) await db.delete(admin_sessions).where(eq(admin_sessions.token_hash, sha256(token)));
  jar.delete(ADMIN_COOKIE);
}

/** Revoke every session of an admin (optionally keeping one), e.g. after a password change. */
export async function revokeAdminSessions(adminId: string, exceptSessionId?: string): Promise<void> {
  await db
    .delete(admin_sessions)
    .where(
      exceptSessionId
        ? and(eq(admin_sessions.admin_id, adminId), ne(admin_sessions.id, exceptSessionId))
        : eq(admin_sessions.admin_id, adminId),
    );
  // opportunistic cleanup of expired rows
  await db.delete(admin_sessions).where(lt(admin_sessions.expires_at, toMysqlDatetime(iso())));
}
