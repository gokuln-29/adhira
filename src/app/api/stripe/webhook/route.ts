import { NextResponse, after, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { orders, payment_links, stripe_events } from "@/lib/db/schema";
import { isDuplicateKey } from "@/lib/db/helpers";
import { getStripe } from "@/lib/stripe/client";
import { sendOrderNotifications } from "@/lib/notify/order-emails";
import { markOrderPaid, transitionOrder } from "@/lib/orders/transitions";
import { autoResolveAlerts, raiseAlert } from "@/lib/ops/alerts";
import { hitRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

// Stripe is the only thing that may mark a card order paid. Steps:
//  1. verify the signature against the RAW body (never request.json() first)
//  2. claim the event id so duplicate / replayed deliveries are no-ops
//  3. match the session to OUR order and check amount + currency
//  4. apply the change through the order state machine (audit-logged)
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;
  try {
    // constructEvent also enforces the 5-minute timestamp tolerance (replay window).
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe webhook] signature verification failed", err);
    // A few are normal noise (probes); a burst means a wrong STRIPE_WEBHOOK_SECRET
    // (every real payment would then fail) or an attack.
    try {
      if (!(await hitRateLimit("stripe-bad-signature", 5, 600))) {
        await raiseAlert({
          kind: "webhook_bad_signature",
          ref: `hour:${new Date().toISOString().slice(0, 13)}`,
          title: "Stripe webhook: repeated invalid signatures",
          details:
            "More than 5 calls to /api/stripe/webhook in 10 minutes failed signature verification.\n" +
            "If you just changed keys, check STRIPE_WEBHOOK_SECRET matches the endpoint's signing secret in the Stripe dashboard (real payments will NOT be recorded until it does). Otherwise someone is probing the endpoint.",
        });
      }
    } catch {
      // alerting must never change the response
    }
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!(await claimEvent(event))) return NextResponse.json({ received: true, duplicate: true });

  try {
    const outcome = await handleEvent(event);
    await db.update(stripe_events).set({ outcome: outcome.slice(0, 200) }).where(eq(stripe_events.id, event.id));
    // A retry that finally worked clears the earlier failure alert for this event.
    await autoResolveAlerts("webhook_failed", event.id);
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[stripe webhook] handler failed", event.type, err);
    await raiseAlert({
      kind: "webhook_failed",
      ref: event.id,
      title: `Stripe webhook failed (${event.type})`,
      details: `Event ${event.id} could not be processed: ${(err as Error)?.message ?? err}\nStripe will retry automatically for up to 3 days; this alert clears itself if a retry succeeds. If it doesn't, a customer may have paid without the order being marked paid.`,
      orderNumber: (event.data.object as { metadata?: { order_number?: string } })?.metadata?.order_number,
    });
    // Let Stripe retry: mark failed so the next delivery may re-claim it.
    await db.update(stripe_events).set({ outcome: "failed" }).where(eq(stripe_events.id, event.id)).catch(() => {});
    return NextResponse.json({ error: "Temporary error" }, { status: 500 });
  }
}

async function claimEvent(event: Stripe.Event): Promise<boolean> {
  try {
    await db.insert(stripe_events).values({ id: event.id, type: event.type, outcome: "processing" });
    return true;
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    // Only a previously *failed* attempt may be retried.
    const [res] = await db
      .update(stripe_events)
      .set({ outcome: "processing" })
      .where(and(eq(stripe_events.id, event.id), eq(stripe_events.outcome, "failed")));
    return res.affectedRows === 1;
  }
}

async function handleEvent(event: Stripe.Event): Promise<string> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return handlePaid(event.data.object as Stripe.Checkout.Session);
    case "checkout.session.expired":
      return handleExpired(event.data.object as Stripe.Checkout.Session);
    default:
      return "ignored";
  }
}

async function handlePaid(session: Stripe.Checkout.Session): Promise<string> {
  // Async methods can complete the session before money has arrived.
  if (session.payment_status !== "paid") return "not paid yet";

  const orderNumber = session.metadata?.order_number;
  if (orderNumber) {
    const rows = await db
      .select({
        id: orders.id,
        total: orders.total,
        currency: orders.currency,
        sessionId: orders.stripe_checkout_session_id,
      })
      .from(orders)
      .where(eq(orders.number, orderNumber))
      .limit(1);
    const order = rows[0];
    const expected = order ? Math.round(order.total * 100) : null;

    // Trust the event only if it is for the session we created for this order
    // and the amount/currency actually charged match what we priced.
    if (
      !order ||
      order.sessionId !== session.id ||
      session.amount_total !== expected ||
      session.currency?.toLowerCase() !== order.currency.toLowerCase()
    ) {
      console.error("[stripe webhook] mismatch or unknown order", {
        orderNumber,
        session: session.id,
        charged: session.amount_total,
        expected,
        currency: session.currency,
      });
      await raiseAlert({
        kind: "payment_mismatch",
        ref: `${orderNumber}:${session.id}`,
        title: order ? `Payment doesn't match order ${orderNumber}` : `Stripe payment for unknown order ${orderNumber}`,
        details:
          `Stripe session ${session.id} is marked paid, but it was NOT applied to the order.\n` +
          `Charged: ${session.amount_total} ${session.currency?.toUpperCase()} (fils)\n` +
          `Expected: ${expected ?? "n/a"} ${order?.currency ?? ""}\n` +
          `Session on order: ${order?.sessionId ?? "n/a"}\n` +
          "Check the payment in the Stripe dashboard. If it is genuine, refund it or (owner) use \"Record a payment received outside Stripe\" on the order.",
        orderNumber: order ? orderNumber : undefined,
      });
      return "mismatch: needs manual review";
    }

    const res = await markOrderPaid(
      { id: order.id },
      "stripe",
      {
        paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
        note: `stripe session ${session.id}`,
      },
    );
    if (!res.ok) {
      await raiseAlert({
        kind: "payment_closed_order",
        ref: orderNumber,
        title: `Customer paid for a closed order ${orderNumber}`,
        details: `Stripe session ${session.id} was paid (${session.amount_total} fils), but ${res.error}\nRefund the customer in Stripe or create a new order for them.`,
        orderNumber,
      });
      return `skipped: ${res.error}`;
    }
    // Email only when THIS delivery changed the order, so retries never double-send.
    if (res.changed) {
      const locale = session.metadata?.locale === "ar" ? "ar" : "en";
      after(() => sendOrderNotifications(orderNumber, locale));
    }
    return res.changed ? "paid" : "already paid";
  }

  if (session.payment_link) {
    const linkId = typeof session.payment_link === "string" ? session.payment_link : session.payment_link.id;
    await db
      .update(payment_links)
      .set({ status: "paid", paid_at: new Date().toISOString() })
      .where(eq(payment_links.provider_ref, linkId));
    return "payment link paid";
  }
  return "no order reference";
}

async function handleExpired(session: Stripe.Checkout.Session): Promise<string> {
  const orderNumber = session.metadata?.order_number;
  if (!orderNumber) return "no order reference";
  const res = await transitionOrder({ number: orderNumber }, "cancelled", "stripe", "checkout session expired");
  return res.ok ? (res.changed ? "cancelled" : "unchanged") : `skipped: ${res.error}`;
}
