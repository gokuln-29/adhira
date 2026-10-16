"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { DELIVERY_SLOTS } from "@/lib/delivery/rules";
import { getDeliveryRulesFresh } from "@/lib/data/delivery";
import { buildStripeLineItems } from "@/lib/stripe/line-items";
import { placeOrder } from "@/lib/orders/place-order";
import { transitionOrder } from "@/lib/orders/transitions";
import { raiseAlert } from "@/lib/ops/alerts";
import { refreshStockPages, syncStockAlerts } from "@/lib/ops/stock";
import { after } from "next/server";
import { assertSameOrigin } from "@/lib/auth/origin";
import { type LineSelection } from "@/lib/pricing";
import { getStripe, isStripeConfigured } from "@/lib/stripe/client";
import { withinRateLimit } from "@/lib/security/rate-limit";
import { orderInputSchema, MAX_LINE_QTY } from "@/lib/validators/order";
import { SITE_URL } from "@/lib/seo/site";
import type { z } from "zod";
import type { EMIRATES } from "@/lib/constants/emirates";

export type Emirate = (typeof EMIRATES)[number];

export type PaymentMethod = "card" | "tabby" | "tamara";

// What the browser may send. Prices are intentionally absent — see below.
export type OrderInput = z.input<typeof orderInputSchema>;

export type OrderResult =
  | { ok: true; token: string; orderNumber: string; redirectUrl?: string }
  | { ok: false; error: string };

const GENERIC_ERROR = "We couldn't place your order. Please try again or contact us.";

// The browser tells us WHICH products and HOW MANY. Everything money-related
// (price, discount, VAT, totals) is read from the database here, so a
// tampered localStorage cart can't change what gets charged.
export async function createOrder(raw: OrderInput): Promise<OrderResult> {
  if (!(await assertSameOrigin())) return { ok: false, error: GENERIC_ERROR };
  const parsed = orderInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }
  const input = parsed.data;

  if (input.paymentMethod === "tabby" || input.paymentMethod === "tamara") {
    return {
      ok: false,
      error: "That payment method is coming soon — please pay by card.",
    };
  }
  if (input.paymentMethod === "card" && !isStripeConfigured()) {
    return {
      ok: false,
      error: "Online payment isn't available right now. Please contact us to place your order.",
    };
  }

  if (!(await withinRateLimit("order", 10, 600))) {
    return { ok: false, error: "Too many orders from this device. Please try again in a few minutes." };
  }

  // Merge duplicate lines so one product can't slip past the quantity cap.
  const pickById = new Map<string, LineSelection>();
  for (const line of input.items) {
    const prev = pickById.get(line.productId);
    pickById.set(line.productId, {
      qty: Math.min((prev?.qty ?? 0) + line.qty, MAX_LINE_QTY),
      vessel: line.vessel,
      months: line.months,
    });
  }

  const notes =
    [
      input.giftMessage && `Gift message: ${input.giftMessage}`,
      input.poNumber && `PO number: ${input.poNumber}`,
      `Delivery slot: ${DELIVERY_SLOTS.find((s) => s.id === input.deliverySlot)?.label ?? input.deliverySlot}`,
    ]
      .filter(Boolean)
      .join(" · ") || null;

  let placed;
  try {
    placed = await placeOrder(input, pickById, input.idempotencyKey ?? null, notes, await getDeliveryRulesFresh());
  } catch (err) {
    console.error("[createOrder] placeOrder failed", err);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!placed.ok) return { ok: false, error: placed.message };
  const { order, lines, vatFils, depositFils } = placed;

  if (!placed.replay) {
    // Stock just went down: update the "N left" pages and raise a low/out-of-stock alert if needed.
    const ids = lines.map((l) => l.productId);
    after(async () => {
      refreshStockPages();
      await syncStockAlerts(ids);
    });
  }

  if (placed.replay) {
    // Same checkout submitted twice: hand back the original order, never a second one.
    if (order.status === "cancelled") return { ok: false, error: GENERIC_ERROR };
    let redirectUrl: string | undefined;
    if (order.payment_method === "card" && order.stripe_checkout_session_id && isStripeConfigured()) {
      const existing = await getStripe().checkout.sessions.retrieve(order.stripe_checkout_session_id);
      if (existing.status === "open" && existing.url) redirectUrl = existing.url;
    }
    return { ok: true, token: order.public_token, orderNumber: order.number, redirectUrl };
  }

  // Card: leave the order `pending` — the Stripe webhook is the source of
  // truth that flips it to `paid`, not this redirect (the buyer can close
  // the tab before returning).
  try {
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: buildStripeLineItems({
          lines,
          deliveryFils: placed.deliveryFils,
          vatFils,
          depositFils,
        }),
        customer_email: input.customer.email,
        metadata: { order_number: order.number, locale: input.locale },
        success_url: `${SITE_URL}/${input.locale}/order-confirmation/${order.public_token}`,
        cancel_url: `${SITE_URL}/${input.locale}/checkout`,
      },
      { idempotencyKey: `checkout-${order.number}` },
    );
    if (!session.url) throw new Error("Stripe returned no checkout URL");

    await db.update(orders).set({ stripe_checkout_session_id: session.id }).where(eq(orders.id, order.id));

    return { ok: true, token: order.public_token, orderNumber: order.number, redirectUrl: session.url };
  } catch (err) {
    console.error("[createOrder] stripe session failed", err);
    // Usually a bad/expired key or a Stripe outage: EVERY card checkout fails until fixed.
    await raiseAlert({
      kind: "stripe_session_failed",
      ref: `hour:${new Date().toISOString().slice(0, 13)}`,
      title: "Customers can't start card payments",
      details: `Creating a Stripe Checkout session failed (latest order ${order.number}): ${(err as Error)?.message ?? err}\nCheck STRIPE_SECRET_KEY and https://status.stripe.com. The affected order was cancelled automatically.`,
      orderNumber: order.number,
    });
    // Don't leave a phantom pending order the team might try to fulfil.
    await transitionOrder({ id: order.id }, "cancelled", "system", "card payment could not be started");
    return { ok: false, error: "We couldn't start the card payment. Please try again in a moment or contact us." };
  }
}
