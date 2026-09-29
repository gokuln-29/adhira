"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectivePrice } from "@/lib/pricing";
import { getStripe, isStripeConfigured } from "@/lib/stripe/client";
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
  const qtyById = new Map<string, number>();
  for (const line of input.items) {
    qtyById.set(line.productId, Math.min((qtyById.get(line.productId) ?? 0) + line.qty, MAX_LINE_QTY));
  }

  const supabase = createAdminClient();

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, base_price, discount_type, discount_value, sale_start, sale_end, vat_rate")
    .in("id", [...qtyById.keys()])
    .eq("status", "active");
  if (productsError) {
    console.error("[createOrder] product lookup failed", productsError);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!products || products.length !== qtyById.size) {
    return {
      ok: false,
      error: "Some items in your cart are no longer available. Please review your cart.",
    };
  }

  // Money in whole fils (integers) so totals never drift by floating-point.
  const lines = products.map((p) => {
    const qty = qtyById.get(p.id)!;
    const price = getEffectivePrice({
      base_price: Number(p.base_price),
      discount_type: p.discount_type as "percent" | "flat" | null,
      discount_value: p.discount_value == null ? null : Number(p.discount_value),
      sale_start: p.sale_start,
      sale_end: p.sale_end,
      vat_rate: Number(p.vat_rate),
    });
    const unitFils = Math.round(price.finalPrice * 100);
    const lineFils = unitFils * qty;
    return {
      productId: p.id,
      name: p.name,
      qty,
      unitFils,
      lineFils,
      vatFils: Math.round((lineFils * price.vatRate) / 100),
    };
  });

  const subtotalFils = lines.reduce((sum, l) => sum + l.lineFils, 0);
  const vatFils = lines.reduce((sum, l) => sum + l.vatFils, 0);
  const deliveryFils = 0;
  const totalFils = subtotalFils + vatFils + deliveryFils;

  const notes =
    [
      input.giftMessage && `Gift message: ${input.giftMessage}`,
      input.poNumber && `PO number: ${input.poNumber}`,
      input.deliverySlot && `Delivery slot: ${input.deliverySlot}`,
    ]
      .filter(Boolean)
      .join(" · ") || null;

  const { data: created, error: createError } = await supabase.rpc("create_order_tx", {
    p: {
      customer: input.customer,
      channel: input.customer.company ? "corporate" : "retail",
      emirate: input.emirate,
      address: input.address,
      delivery_date: input.deliveryDate ?? null,
      notes,
      subtotal: subtotalFils / 100,
      vat: vatFils / 100,
      delivery_fee: deliveryFils / 100,
      total: totalFils / 100,
      items: lines.map((l) => ({
        product_id: l.productId,
        name: l.name,
        qty: l.qty,
        unit_price: l.unitFils / 100,
        line_total: l.lineFils / 100,
      })),
    },
  });

  const order = created as { id: string; number: string; public_token: string } | null;
  if (createError || !order) {
    console.error("[createOrder] create_order_tx failed", createError);
    return { ok: false, error: GENERIC_ERROR };
  }

  if (input.paymentMethod !== "card") {
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
              product_data: { name: l.name },
              unit_amount: l.unitFils,
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
        ].filter((l) => l.price_data.unit_amount > 0),
        customer_email: input.customer.email,
        metadata: { order_number: order.number },
        success_url: `${SITE_URL}/${input.locale}/order-confirmation/${order.public_token}`,
        cancel_url: `${SITE_URL}/${input.locale}/checkout`,
      },
      { idempotencyKey: `checkout-${order.number}` },
    );
    if (!session.url) throw new Error("Stripe returned no checkout URL");

    await supabase
      .from("orders")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", order.id);

    return { ok: true, token: order.public_token, orderNumber: order.number, redirectUrl: session.url };
  } catch (err) {
    console.error("[createOrder] stripe session failed", err);
    // Don't leave a phantom pending order the team might try to fulfil.
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id);
    return { ok: false, error: "We couldn't start the card payment. Please try again or choose Cash on Delivery." };
  }
}
