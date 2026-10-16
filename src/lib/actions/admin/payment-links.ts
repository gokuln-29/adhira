"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, payment_links } from "@/lib/db/schema";
import { dbErrorMessage, newId } from "@/lib/db/helpers";
import { authorize } from "@/lib/admin/auth";
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
  const auth = await authorize("ownerOnly");
  if (!auth.ok) return auth;

  if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 1_000_000) {
    return { ok: false, error: "Enter an amount between 0.01 and 1,000,000." };
  }
  if (input.url.trim() && !/^https:\/\//i.test(input.url.trim())) {
    return { ok: false, error: "The payment link must start with https://" };
  }

  let customerId: string | null = null;
  if (input.customerEmail) {
    // Email column is case-insensitive (utf8mb4_0900_ai_ci).
    const found = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.email, input.customerEmail.trim()))
      .limit(1);
    customerId = found[0]?.id ?? null;
  }

  let url = input.url.trim() || null;
  let providerRef: string | null = null;

  if (isStripeConfigured() && input.amount > 0) {
    const stripe = getStripe();
    const product = await stripe.products.create({
      name: input.description.trim() || "Adhira Flowers payment",
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

  const id = newId();
  try {
    await db.insert(payment_links).values({
      id,
      amount: input.amount,
      description: input.description.trim() || null,
      customer_id: customerId,
      status: "pending",
      url,
      provider_ref: providerRef,
    });
  } catch (err) {
    return { ok: false, error: dbErrorMessage(err, "payment link") };
  }
  revalidatePath("/admin/payment-links");
  return { ok: true, id };
}

export async function markPaymentLinkStatus(
  id: string,
  status: "pending" | "paid" | "expired",
): Promise<ActionResult> {
  const auth = await authorize("ownerOnly");
  if (!auth.ok) return auth;
  if (!["pending", "paid", "expired"].includes(status)) return { ok: false, error: "Unknown status." };
  try {
    await db
      .update(payment_links)
      .set({ status, paid_at: status === "paid" ? new Date().toISOString() : null })
      .where(eq(payment_links.id, id));
  } catch (err) {
    return { ok: false, error: dbErrorMessage(err, "payment link") };
  }
  revalidatePath("/admin/payment-links");
  return { ok: true };
}
