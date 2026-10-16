import "server-only";
import { SITE_NAME } from "@/lib/seo/site";

// Transactional email over Brevo's HTTP API (no SDK). Without BREVO_API_KEY
// every call is a quiet no-op, so the shop works before email is set up.
// Failures are logged and never thrown, so a mail outage can never block an
// order; callers that must know (sign-in codes) read the boolean result.
export interface Email {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: { name: string; content: Buffer }[];
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(email: Email): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  try {
    const res = await fetch(process.env.BREVO_API_URL || "https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY!,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: process.env.EMAIL_FROM, name: process.env.EMAIL_FROM_NAME || SITE_NAME },
        to: [{ email: email.to }],
        subject: email.subject,
        htmlContent: email.html,
        ...(email.replyTo ? { replyTo: { email: email.replyTo } } : {}),
        ...(email.attachments?.length
          ? { attachment: email.attachments.map((a) => ({ name: a.name, content: a.content.toString("base64") })) }
          : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("[email] send failed", res.status, (await res.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] send error", err);
    return false;
  }
}

// Everything interpolated into email HTML must be escaped: names, addresses
// and messages are typed by visitors.
export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
