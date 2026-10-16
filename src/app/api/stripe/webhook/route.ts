import { NextResponse, after, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { orders, payment_links, stripe_events } from "@/lib/db/schema";
import { isDuplicateKey } from "@/lib/db/helpers";
import { getStripe } from "@/lib/stripe/client";
import { sendOrderNotifications } from "@/lib/notify/order-emails";
import { markOrderPaid, transitionOrder } from "@/lib/orders/transitions";

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
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!(await claimEvent(event))) return NextResponse.json({ received: true, duplicate: true });

  try {
    const outcome = await handleEvent(event);
    await db.update(stripe_events).set({ outcome: outcome.slice(0, 200) }).where(eq(stripe_events.id, event.id));
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[stripe webhook] handler failed", event.type, err);
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
    if (!res.ok) return `skipped: ${res.error}`;
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
