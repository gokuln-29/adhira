"use server";

import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { placeOrder } from "@/lib/orders/place-order";
import { transitionOrder } from "@/lib/orders/transitions";
import { assertSameOrigin } from "@/lib/auth/origin";
import { priceLine, type LineSelection } from "@/lib/pricing";
import { getStripe, isStripeConfigured } from "@/lib/stripe/client";
import { sendOrderNotifications } from "@/lib/notify/order-emails";
import { withinRateLimit } from "@/lib/security/rate-limit";
import { orderInputSchema, MAX_LINE_QTY } from "@/lib/validators/order";
import { SITE_URL } from "@/lib/seo/site";
import type { z } from "zod";
import type { EMIRATES } from "@/lib/constants/emirates";

export type Emirate = (typeof EMIRATES)[number];

export type PaymentMethod = "cod" | "card" | "tabby" | "tamara";

// What the browser may send. Prices are intentionally absent — see below.
export type OrderInput = z.input<typeof orderInputSchema>;

export type OrderResult =
  | { ok: true; token: string; orderNumber: string; redirectUrl?: string }
  | { ok: false; error: string };

const GENERIC_ERROR = "We couldn't place your order. Please try again or contact us.";

function todayInDubai(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });
}

function addYears(isoDate: string, years: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

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
      error: "That payment method is coming soon — please choose Cash on Delivery or Card.",
    };
  }
  if (input.paymentMethod === "card" && !isStripeConfigured()) {
    return {
      ok: false,
      error: "Card payment isn't available yet — please choose Cash on Delivery.",
    };
  }

  if (input.deliveryDate) {
    const today = todayInDubai();
    if (input.deliveryDate < today || input.deliveryDate > addYears(today, 1)) {
      return { ok: false, error: "Please choose a valid delivery date." };
    }
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
      input.deliverySlot && `Delivery slot: ${input.deliverySlot}`,
    ]
      .filter(Boolean)
      .join(" · ") || null;

  let placed;
  try {
    placed = await placeOrder(input, pickById, input.idempotencyKey ?? null, notes);
  } catch (err) {
    console.error("[createOrder] placeOrder failed", err);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!placed.ok) return { ok: false, error: placed.message };
  const { order, lines, vatFils, depositFils } = placed;

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

  if (input.paymentMethod !== "card") {
    // Cash on delivery: the order is final now, so email right away (after the
    // response is sent, so it never slows checkout).
    after(() => sendOrderNotifications(order.number, input.locale));
    return { ok: true, token: order.public_token, orderNumber: order.number };
  }

  // Card: leave the order `pending` — the Stripe webhook is the source of
  // truth that flips it to `paid`, not this redirect (the buyer can close
  // the tab before returning).
  try {
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          ...lines.map((l) => ({
            price_data: {
              currency: "aed",
              product_data: {
                name: l.isRental ? `${l.name} (rental, ${l.months} months)` : l.name,
              },
              unit_amount: l.unitFils,
            },
            quantity: l.qty,
          })),
          ...lines
            .filter((l) => l.vessel)
            .map((l) => ({
              price_data: {
                currency: "aed",
                product_data: { name: `Glass vessel: ${l.name}` },
                unit_amount: l.vesselUnitFils,
              },
              quantity: l.qty,
            })),
          // Prices are stored VAT-exclusive with VAT broken out separately,
          // so it needs its own line for the charge to match `orders.total`.
          {
            price_data: {
              currency: "aed",
              product_data: { name: "VAT" },
              unit_amount: vatFils,
            },
            quantity: 1,
          },
          {
            price_data: {
              currency: "aed",
              product_data: { name: "Refundable deposit" },
              unit_amount: depositFils,
            },
            quantity: 1,
          },
        ].filter((l) => l.price_data.unit_amount > 0),
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
    // Don't leave a phantom pending order the team might try to fulfil.
    await transitionOrder({ id: order.id }, "cancelled", "system", "card payment could not be started");
    return { ok: false, error: "We couldn't start the card payment. Please try again or choose Cash on Delivery." };
  }
}
