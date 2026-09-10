"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectivePrice } from "@/lib/pricing";
import { getStripe, isStripeConfigured } from "@/lib/stripe/client";
import type { CartLineItem } from "@/lib/cart/types";
import type { EMIRATES } from "@/lib/constants/emirates";

export type Emirate = (typeof EMIRATES)[number];

export type PaymentMethod = "cod" | "card" | "tabby" | "tamara";

export interface OrderInput {
  customer: {
    name: string;
    email: string;
    phone: string;
    company?: string;
    trn?: string;
  };
  emirate: Emirate;
  address: {
    line1: string;
    line2?: string;
    area?: string;
    landmark?: string;
  };
  deliveryDate?: string;
  deliverySlot?: string;
  giftMessage?: string;
  poNumber?: string;
  paymentMethod: PaymentMethod;
  items: CartLineItem[];
  /** Current storefront locale, used to build Stripe's success/cancel URLs. */
  locale: string;
}

export type OrderResult =
  | { ok: true; orderNumber: string; redirectUrl?: string }
  | { ok: false; error: string };

function generateOrderNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `FG-${stamp}-${rand}`;
}

export async function createOrder(input: OrderInput): Promise<OrderResult> {
  if (!input.items.length) {
    return { ok: false, error: "Your cart is empty." };
  }
  if (!input.customer.name?.trim() || !input.customer.email?.trim()) {
    return { ok: false, error: "Name and email are required." };
  }
  if (input.paymentMethod === "tabby" || input.paymentMethod === "tamara") {
    return {
      ok: false,
      error: `${input.paymentMethod === "tabby" ? "Tabby" : "Tamara"} is coming soon — please choose Cash on Delivery or Card for now.`,
    };
  }
  if (input.paymentMethod === "card" && !isStripeConfigured()) {
    return {
      ok: false,
      error: "Card payment isn't configured yet — please choose Cash on Delivery for now.",
    };
  }

  const supabase = createAdminClient();

  const { data: existingCustomer, error: lookupError } = await supabase
    .from("customers")
    .select("id")
    .ilike("email", input.customer.email.trim())
    .maybeSingle();
  if (lookupError) return { ok: false, error: lookupError.message };

  let customerId = existingCustomer?.id as string | undefined;

  if (!customerId) {
    const { data: newCustomer, error: insertCustomerError } = await supabase
      .from("customers")
      .insert({
        name: input.customer.name.trim(),
        email: input.customer.email.trim(),
        phone: input.customer.phone?.trim() || null,
        company: input.customer.company?.trim() || null,
        trn: input.customer.trn?.trim() || null,
        type: input.customer.company ? "corporate" : "retail",
      })
      .select("id")
      .single();
    if (insertCustomerError) return { ok: false, error: insertCustomerError.message };
    customerId = newCustomer.id;
  }

  const lines = input.items.map((item) => {
    const price = getEffectivePrice(item);
    const lineTotal = Math.round(price.finalPrice * item.qty * 100) / 100;
    return { item, unitPrice: price.finalPrice, lineTotal, vatRate: price.vatRate };
  });

  const subtotal = Math.round(lines.reduce((sum, l) => sum + l.lineTotal, 0) * 100) / 100;
  const vat =
    Math.round(
      lines.reduce((sum, l) => sum + (l.lineTotal * l.vatRate) / 100, 0) * 100,
    ) / 100;
  const deliveryFee = 0;
  const total = Math.round((subtotal + vat + deliveryFee) * 100) / 100;

  const notesParts = [
    input.giftMessage && `Gift message: ${input.giftMessage}`,
    input.poNumber && `PO number: ${input.poNumber}`,
    input.deliverySlot && `Delivery slot: ${input.deliverySlot}`,
  ].filter(Boolean);

  const orderNumber = generateOrderNumber();

  const { error: orderError } = await supabase.from("orders").insert({
    number: orderNumber,
    customer_id: customerId,
    channel: input.customer.company ? "corporate" : "retail",
    status: "pending",
    subtotal,
    vat,
    delivery_fee: deliveryFee,
    total,
    currency: "AED",
    emirate: input.emirate,
    address: { ...input.address },
    delivery_date: input.deliveryDate || null,
    notes: notesParts.join(" · ") || null,
  });
  if (orderError) return { ok: false, error: orderError.message };

  const { data: orderRow, error: orderLookupError } = await supabase
    .from("orders")
    .select("id")
    .eq("number", orderNumber)
    .single();
  if (orderLookupError) return { ok: false, error: orderLookupError.message };

  const { error: itemsError } = await supabase.from("order_items").insert(
    lines.map((l) => ({
      order_id: orderRow.id,
      product_id: l.item.productId,
      name: l.item.name,
      qty: l.item.qty,
      unit_price: l.unitPrice,
      line_total: l.lineTotal,
    })),
  );
  if (itemsError) return { ok: false, error: itemsError.message };

  if (input.paymentMethod !== "card") {
    return { ok: true, orderNumber };
  }

  // Card: leave the order `pending` — the Stripe webhook is the source of
  // truth that flips it to `paid`, not this redirect (the buyer can close
  // the tab before returning).
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      ...lines.map((l) => ({
        price_data: {
          currency: "aed",
          product_data: { name: l.item.name },
          unit_amount: Math.round(l.unitPrice * 100),
        },
        quantity: l.item.qty,
      })),
      // Prices are stored/displayed VAT-exclusive with VAT broken out
      // separately (see `vatNote()`), so it needs its own Stripe line item
      // for the charged total to match `orders.total`.
      {
        price_data: {
          currency: "aed",
          product_data: { name: "VAT (5%)" },
          unit_amount: Math.round(vat * 100),
        },
        quantity: 1,
      },
    ],
    customer_email: input.customer.email.trim(),
    metadata: { order_number: orderNumber },
    success_url: `${siteUrl}/${input.locale}/order-confirmation/${orderNumber}`,
    cancel_url: `${siteUrl}/${input.locale}/checkout`,
  });

  const { error: sessionUpdateError } = await supabase
    .from("orders")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", orderRow.id);
  if (sessionUpdateError) return { ok: false, error: sessionUpdateError.message };

  if (!session.url) {
    return { ok: false, error: "Could not start the Stripe checkout session." };
  }

  return { ok: true, orderNumber, redirectUrl: session.url };
}
