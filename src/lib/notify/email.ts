import "server-only";

// Minimal email sender over Resend's HTTP API (no SDK, no extra dependency).
// Off by default: without RESEND_API_KEY every call is a quiet no-op, so the
// shop works before email is set up. Failures are logged and never thrown, so a
// mail outage can never block an order.
export interface Email {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(email: Email): Promise<void> {
  if (!isEmailConfigured()) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        reply_to: email.replyTo,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("[email] send failed", res.status, (await res.text()).slice(0, 300));
    }
  } catch (err) {
    console.error("[email] send error", err);
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
