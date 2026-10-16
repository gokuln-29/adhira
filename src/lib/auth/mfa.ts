import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { admin_users } from "@/lib/db/schema";
import { decryptAtRest, hmac, safeEqual } from "@/lib/auth/crypto";
import { verifyTotp } from "@/lib/auth/totp";

type AdminRow = typeof admin_users.$inferSelect;

/**
 * Accepts either a current authenticator code (rejecting replays of an already
 * used time step) or a one-time recovery code, and consumes whichever matched.
 * Callers must rate-limit; this only checks.
 */
export async function consumeMfaCode(admin: AdminRow, rawCode: string): Promise<boolean> {
  if (!admin.totp_secret) return false;
  const code = rawCode.trim();
  const step = verifyTotp(decryptAtRest(admin.totp_secret), code, admin.totp_last_step);
  if (step != null) {
    await db.update(admin_users).set({ totp_last_step: step }).where(eq(admin_users.id, admin.id));
    return true;
  }
  const hashed = hmac(`recovery:${code.toLowerCase().replace(/\s|-/g, "")}`);
  const codes = admin.recovery_codes ?? [];
  const idx = codes.findIndex((c) => safeEqual(c, hashed));
  if (idx < 0) return false;
  await db
    .update(admin_users)
    .set({ recovery_codes: codes.filter((_, i) => i !== idx) })
    .where(eq(admin_users.id, admin.id));
  return true;
}
