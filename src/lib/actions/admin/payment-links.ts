"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe/client";

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface PaymentLinkInput {
  amount: number;
  description: string;
  customerEmail: string;
  url: string;
}

// Creates a real Stripe Payment Link when STRIPE_SECRET_KEY is set; falls
// back to recording a manually-pasted URL otherwise, so the tracking/
// status/WhatsApp-share workflow is usable before Stripe keys exist.
export async function createPaymentLink(
  input: PaymentLinkInput,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();

  let customerId: string | null = null;
  if (input.customerEmail) {
    const { data } = await supabase
      .from("customers")
      .select("id")
      .ilike("email", input.customerEmail.trim())
      .maybeSingle();
    customerId = data?.id ?? null;
  }

  let url = input.url.trim() || null;
  let providerRef: string | null = null;

  if (isStripeConfigured() && input.amount > 0) {
    const stripe = getStripe();
    const product = await stripe.products.create({
      name: input.description.trim() || "Flowers & Gifts payment",
    });
    const price = await stripe.prices.create({
      product: product.id,
      currency: "aed",
      unit_amount: Math.round(input.amount * 100),
    });
    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
    });
    url = link.url;
    providerRef = link.id;
  }

  const { data, error } = await supabase
    .from("payment_links")
    .insert({
      amount: input.amount,
      description: input.description.trim() || null,
      customer_id: customerId,
      status: "pending",
      url,
      provider_ref: providerRef,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/payment-links");
  return { ok: true, id: data.id };
}

export async function markPaymentLinkStatus(
  id: string,
  status: "pending" | "paid" | "expired",
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("payment_links")
    .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/payment-links");
  return { ok: true };
}
