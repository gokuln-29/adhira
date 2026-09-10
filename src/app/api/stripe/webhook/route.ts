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
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const supabase = createAdminClient();

    const orderNumber = session.metadata?.order_number;
    if (orderNumber) {
      // Only flip `pending` -> `paid`: a duplicate/late webhook delivery
      // must not regress an order an admin has already moved further along.
      await supabase
        .from("orders")
        .update({
          status: "paid",
          stripe_payment_intent_id:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
        })
        .eq("number", orderNumber)
        .eq("status", "pending");
    } else if (session.payment_link) {
      const paymentLinkId =
        typeof session.payment_link === "string" ? session.payment_link : session.payment_link.id;
      await supabase
        .from("payment_links")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("provider_ref", paymentLinkId)
        .eq("status", "pending");
    }
  }

  return NextResponse.json({ received: true });
}
