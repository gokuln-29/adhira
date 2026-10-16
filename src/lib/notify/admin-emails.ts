import "server-only";
import { esc, sendEmail } from "@/lib/notify/email";
import { SITE_NAME, SITE_URL } from "@/lib/seo/site";

const shell = (body: string) => `<!doctype html><html><body style="margin:0;background:#fafbfa;font-family:Arial,Helvetica,sans-serif;color:#0e1512">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="font-size:12px;letter-spacing:2px;color:#0e7c5a;margin:0 0 12px">${esc(SITE_NAME.toUpperCase())} · ADMIN</p>
${body}
</div></body></html>`;

export async function sendPasswordResetEmail(to: string, name: string, link: string, ttlMinutes: number): Promise<void> {
  const sent = await sendEmail({
    to,
    subject: `Reset your ${SITE_NAME} admin password`,
    html: shell(`<h1 style="font-size:22px;margin:0 0 12px">Reset your password</h1>
<p>Hi ${esc(name)}, we received a request to reset your admin password.</p>
<p style="margin:24px 0"><a href="${esc(link)}" style="background:#0e7c5a;color:#fff;padding:12px 20px;text-decoration:none;font-size:14px">Choose a new password</a></p>
<p style="color:#6b756f;font-size:13px">This link works once and expires in ${ttlMinutes} minutes. If you didn't ask for it, ignore this email: your password hasn't changed. If you have two-factor authentication on, you'll also need your authenticator or a recovery code.</p>`),
  });
  if (!sent && process.env.NODE_ENV !== "production") console.warn(`[auth:dev] password reset link for ${to}: ${link}`);
  if (!sent && process.env.NODE_ENV === "production") console.error("[admin-reset] reset email was not sent");
}

export async function sendPasswordChangedNotice(to: string, name: string): Promise<void> {
  await sendEmail({
    to,
    subject: `Your ${SITE_NAME} admin password was changed`,
    html: shell(`<h1 style="font-size:22px;margin:0 0 12px">Password changed</h1>
<p>Hi ${esc(name)}, your admin password was just changed and every session was signed out.</p>
<p style="color:#6b756f;font-size:13px">If this wasn't you, reset it again straight away at ${esc(`${SITE_URL}/admin/login`)} and tell the shop owner.</p>`),
  });
}
