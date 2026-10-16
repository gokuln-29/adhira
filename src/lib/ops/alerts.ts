import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { ops_alerts } from "@/lib/db/schema";
import { newId } from "@/lib/db/helpers";
import { esc, sendEmail } from "@/lib/notify/email";
import { teamEmailAddress } from "@/lib/notify/order-emails";
import { store_settings } from "@/lib/db/schema";
import { SITE_NAME, SITE_URL } from "@/lib/seo/site";

export type AlertKind =
  | "payment_mismatch" // Stripe says paid, but amount/currency/session don't match our order
  | "payment_closed_order" // money arrived for an order we had cancelled/refunded
  | "webhook_failed" // our webhook handler threw (DB down, bug...); Stripe will retry
  | "webhook_bad_signature" // burst of webhook calls with an invalid signature
  | "stripe_session_failed"; // customers can't start card payment at all

export interface RaiseAlert {
  kind: AlertKind;
  /** Dedupe key: the same (kind, ref) never emails twice until it is resolved. */
  ref: string;
  title: string;
  details?: string;
  orderNumber?: string;
  severity?: "critical" | "warning";
}

function alertEmailAddress(contact: string | null): string | null {
  return process.env.ALERT_EMAIL || teamEmailAddress(contact);
}

async function contactEmail(): Promise<string | null> {
  try {
    return (await db.select({ e: store_settings.contact_email }).from(store_settings).limit(1))[0]?.e ?? null;
  } catch {
    return null;
  }
}

async function emailAlert(a: RaiseAlert): Promise<boolean> {
  const to = alertEmailAddress(await contactEmail());
  if (!to) return false;
  const orderLink = a.orderNumber ? `${SITE_URL}/admin/orders/${encodeURIComponent(a.orderNumber)}` : `${SITE_URL}/admin`;
  return sendEmail({
    to,
    subject: `[${SITE_NAME} ALERT] ${a.title}`,
    html: `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#0e1512">
<h2 style="margin:0 0 8px;color:#b42318">${esc(a.title)}</h2>
${a.details ? `<p style="white-space:pre-wrap">${esc(a.details)}</p>` : ""}
<p><a href="${esc(orderLink)}">${a.orderNumber ? `Open order ${esc(a.orderNumber)}` : "Open the admin dashboard"}</a></p>
<p style="color:#6b756f;font-size:13px">This alert is shown on the admin dashboard until someone resolves it. Repeats of the same problem won't email again.</p>
</body></html>`,
  });
}

/**
 * Records a problem that needs a human and emails it once. Never throws: the code
 * path that raises an alert is usually already handling a failure. If the database
 * itself is the problem, it still tries to send the email (without dedupe).
 */
export async function raiseAlert(a: RaiseAlert): Promise<void> {
  console.error(`[ALERT:${a.kind}] ${a.title}`, a.details ?? "", a.orderNumber ?? "");
  try {
    // Left to right: email_sent_at must be decided from the OLD resolved_at, so it
    // is assigned before resolved_at is cleared.
    await db
      .insert(ops_alerts)
      .values({
        id: newId(),
        kind: a.kind,
        ref: a.ref.slice(0, 120),
        severity: a.severity ?? "critical",
        title: a.title.slice(0, 200),
        details: a.details ?? null,
        order_number: a.orderNumber ?? null,
      })
      .onDuplicateKeyUpdate({
        set: {
          occurrences: sql`${ops_alerts.occurrences} + 1`,
          last_seen_at: sql`UTC_TIMESTAMP(3)`,
          details: a.details ?? null,
          email_sent_at: sql`IF(${ops_alerts.resolved_at} IS NULL, ${ops_alerts.email_sent_at}, NULL)`,
          resolved_at: sql`NULL`,
          resolved_by: sql`NULL`,
        },
      });
    const [row] = await db
      .select({ id: ops_alerts.id })
      .from(ops_alerts)
      .where(and(eq(ops_alerts.kind, a.kind), eq(ops_alerts.ref, a.ref.slice(0, 120))))
      .limit(1);
    if (!row) return;
    // Claim the right to email: only one of several concurrent raisers wins.
    const [claim] = await db
      .update(ops_alerts)
      .set({ email_sent_at: new Date().toISOString() })
      .where(and(eq(ops_alerts.id, row.id), isNull(ops_alerts.email_sent_at)));
    if (claim.affectedRows !== 1) return;
    if (!(await emailAlert(a))) {
      // Not delivered (no address / provider down): allow the next occurrence to retry.
      await db.update(ops_alerts).set({ email_sent_at: null }).where(eq(ops_alerts.id, row.id));
    }
  } catch (err) {
    console.error("[alerts] could not record alert, emailing directly", err);
    await emailAlert(a).catch(() => {});
  }
}

/** The condition cleared by itself (e.g. Stripe's retry finally succeeded). */
export async function autoResolveAlerts(kind: AlertKind, ref: string): Promise<void> {
  try {
    await db
      .update(ops_alerts)
      .set({ resolved_at: new Date().toISOString() })
      .where(and(eq(ops_alerts.kind, kind), eq(ops_alerts.ref, ref), isNull(ops_alerts.resolved_at)));
  } catch (err) {
    console.error("[alerts] auto-resolve failed", err);
  }
}

export interface OpenAlert {
  id: string;
  kind: string;
  severity: "critical" | "warning";
  title: string;
  details: string | null;
  order_number: string | null;
  occurrences: number;
  created_at: string;
  last_seen_at: string;
}

export async function getOpenAlerts(): Promise<OpenAlert[]> {
  return db
    .select({
      id: ops_alerts.id,
      kind: ops_alerts.kind,
      severity: ops_alerts.severity,
      title: ops_alerts.title,
      details: ops_alerts.details,
      order_number: ops_alerts.order_number,
      occurrences: ops_alerts.occurrences,
      created_at: ops_alerts.created_at,
      last_seen_at: ops_alerts.last_seen_at,
    })
    .from(ops_alerts)
    .where(isNull(ops_alerts.resolved_at))
    .orderBy(desc(ops_alerts.last_seen_at));
}
