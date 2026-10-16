"use server";

import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { customers, otp_codes, toMysqlDatetime } from "@/lib/db/schema";
import { newId } from "@/lib/db/helpers";
import { createCustomerSession, destroyCustomerSession } from "@/lib/auth/customer-session";
import { hmac, safeEqual } from "@/lib/auth/crypto";
import { assertSameOrigin } from "@/lib/auth/origin";
import { sendEmail, esc } from "@/lib/notify/email";
import { hitRateLimit, withinRateLimit } from "@/lib/security/rate-limit";
import { SITE_NAME } from "@/lib/seo/site";

const OTP_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;

const emailSchema = z.string().trim().toLowerCase().email().max(255);
const codeSchema = z.string().trim().regex(/^\d{6}$/);

type Result = { ok: true } | { ok: false; error: string };

const MAIL = {
  en: {
    subject: (c: string) => `${c} is your ${SITE_NAME} sign-in code`,
    line: `Use this code to sign in. It expires in ${OTP_TTL_MIN} minutes.`,
    ignore: "If you didn't ask for this, you can ignore this email.",
    dir: "ltr",
  },
  ar: {
    subject: (c: string) => `${c} هو رمز تسجيل الدخول إلى ${SITE_NAME}`,
    line: `استخدم هذا الرمز لتسجيل الدخول. ينتهي خلال ${OTP_TTL_MIN} دقائق.`,
    ignore: "إذا لم تطلب هذا الرمز فتجاهل هذه الرسالة.",
    dir: "rtl",
  },
} as const;

// Always answers the same way whether or not the address is known, so the form
// can't be used to enumerate customers.
export async function requestSignInCode(rawEmail: string, locale: "en" | "ar" = "en"): Promise<Result> {
  if (!(await assertSameOrigin())) return { ok: false, error: "Request blocked." };
  const email = emailSchema.safeParse(rawEmail);
  if (!email.success) return { ok: false, error: "Please enter a valid email address." };
  const addr = email.data;

  if (!(await withinRateLimit("otp-request", 10, 600)) || !(await hitRateLimit(`otp-request-email:${addr}`, 3, 600))) {
    return { ok: false, error: "Too many requests. Please wait a few minutes and try again." };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  // Only the latest code is valid: drop earlier unused ones.
  await db.delete(otp_codes).where(and(eq(otp_codes.email, addr), isNull(otp_codes.consumed_at)));
  await db.insert(otp_codes).values({
    id: newId(),
    email: addr,
    code_hash: hmac(`otp:${addr}:${code}`),
    expires_at: new Date(Date.now() + OTP_TTL_MIN * 60_000).toISOString(),
  });

  const t = MAIL[locale === "ar" ? "ar" : "en"];
  const sent = await sendEmail({
    to: addr,
    subject: t.subject(code),
    html: `<!doctype html><html dir="${t.dir}"><body style="font-family:Arial,Helvetica,sans-serif;color:#0e1512">
<p>${esc(t.line)}</p>
<p style="font-size:32px;letter-spacing:8px;font-weight:700;margin:16px 0">${esc(code)}</p>
<p style="color:#6b756f;font-size:13px">${esc(t.ignore)}</p></body></html>`,
  });
  if (!sent) {
    // Surface email-provider outages: nobody can sign in without the email.
    console.error("[auth] sign-in code email was not sent for", addr.replace(/(.).+(@.+)/, "$1***$2"));
    if (process.env.NODE_ENV !== "production") console.warn(`[auth:dev] sign-in code for ${addr}: ${code}`);
    else return { ok: false, error: "We couldn't send the code right now. Please try again shortly." };
  }
  return { ok: true };
}

export async function verifySignInCode(rawEmail: string, rawCode: string): Promise<Result> {
  if (!(await assertSameOrigin())) return { ok: false, error: "Request blocked." };
  const email = emailSchema.safeParse(rawEmail);
  const code = codeSchema.safeParse(rawCode);
  if (!email.success || !code.success) return { ok: false, error: "That code isn't right." };
  const addr = email.data;

  if (!(await withinRateLimit("otp-verify", 30, 600))) {
    return { ok: false, error: "Too many attempts. Please wait a few minutes." };
  }

  const rows = await db
    .select()
    .from(otp_codes)
    .where(
      and(eq(otp_codes.email, addr), isNull(otp_codes.consumed_at), gt(otp_codes.expires_at, toMysqlDatetime(new Date()))),
    )
    .orderBy(desc(otp_codes.created_at))
    .limit(1);
  const otp = rows[0];
  if (!otp || otp.attempts >= MAX_ATTEMPTS) return { ok: false, error: "That code has expired. Request a new one." };

  // Count the attempt before comparing, so parallel guesses can't beat the cap.
  await db.update(otp_codes).set({ attempts: otp.attempts + 1 }).where(eq(otp_codes.id, otp.id));
  if (!safeEqual(otp.code_hash, hmac(`otp:${addr}:${code.data}`))) {
    return { ok: false, error: "That code isn't right." };
  }
  await db.update(otp_codes).set({ consumed_at: new Date().toISOString() }).where(eq(otp_codes.id, otp.id));

  // Proving the mailbox is the identity: reuse the customer row guest checkout
  // may already have created for this email, or create one.
  const existing = await db.select({ id: customers.id }).from(customers).where(eq(customers.email, addr)).limit(1);
  let customerId = existing[0]?.id;
  if (!customerId) {
    customerId = newId();
    await db.insert(customers).values({ id: customerId, name: addr.split("@")[0], email: addr }).onDuplicateKeyUpdate({ set: { email: addr } });
    const again = await db.select({ id: customers.id }).from(customers).where(eq(customers.email, addr)).limit(1);
    customerId = again[0]!.id;
  }
  await createCustomerSession(customerId);
  return { ok: true };
}

export async function signOutCustomer(): Promise<void> {
  if (!(await assertSameOrigin())) return;
  await destroyCustomerSession();
}
