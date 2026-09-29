import { NextResponse, type NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import type Stripe from "stripe";

// Stripe webhooks need the raw request body for signature verification —
// don't call request.json() anywhere on this path before constructEvent.
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe webhook] signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const supabase = createAdminClient();

    // Async methods can complete the session before money has arrived.
    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true });
    }

    const orderNumber = session.metadata?.order_number;
    if (orderNumber) {
      const { data: order, error: lookupError } = await supabase
        .from("orders")
        .select("total")
        .eq("number", orderNumber)
        .maybeSingle();
      if (lookupError) {
        console.error("[stripe webhook] order lookup failed", lookupError);
        return NextResponse.json({ error: "Temporary error" }, { status: 500 }); // Stripe retries
      }

      // Only trust the event if the amount really charged matches the order.
      if (!order || session.amount_total !== Math.round(Number(order.total) * 100)) {
        console.error("[stripe webhook] amount mismatch or unknown order", {
          orderNumber,
          charged: session.amount_total,
          expected: order ? Math.round(Number(order.total) * 100) : null,
        });
        return NextResponse.json({ received: true });
      }

      // Only flip `pending` -> `paid`: a duplicate/late delivery must not
      // regress an order an admin has already moved further along.
      const { error } = await supabase
        .from("orders")
        .update({
          status: "paid",
          stripe_payment_intent_id:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
        })
        .eq("number", orderNumber)
        .eq("status", "pending");
      if (error) {
        console.error("[stripe webhook] order update failed", error);
        return NextResponse.json({ error: "Temporary error" }, { status: 500 });
      }
    } else if (session.payment_link) {
      const paymentLinkId =
        typeof session.payment_link === "string" ? session.payment_link : session.payment_link.id;
      const { error } = await supabase
        .from("payment_links")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("provider_ref", paymentLinkId)
        .eq("status", "pending");
      if (error) {
        console.error("[stripe webhook] payment link update failed", error);
        return NextResponse.json({ error: "Temporary error" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
