"use server";

import { eq, inArray, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { assertSameOrigin } from "@/lib/auth/origin";
import { Reject, priceProductRow } from "@/lib/orders/place-order";
import { evaluateCoupon } from "@/lib/offers/evaluate";
import type { CouponErrorCode } from "@/lib/offers/coupon";
import { withinRateLimit } from "@/lib/security/rate-limit";
import { MAX_CART_LINES, MAX_LINE_QTY } from "@/lib/validators/order";

const quoteSchema = z.object({
  code: z.string().trim().min(1).max(40),
  email: z.string().trim().max(200).optional(),
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        qty: z.number().int().min(1).max(MAX_LINE_QTY),
        vessel: z.boolean().default(false),
        months: z.number().int().min(1).max(60).default(1),
      }),
    )
    .min(1)
    .max(MAX_CART_LINES),
});

export type CouponQuote =
  | {
      ok: true;
      code: string;
      title: string;
      /** Everything in fils. */
      discountFils: number;
      netSubtotalFils: number;
      goodsVatFils: number;
    }
  | { ok: false; reason: CouponErrorCode | "rate" | "cart"; error: string; min?: number };

// Checkout preview. The same server code that places the order prices the cart and
// evaluates the code, so what the customer sees is what they will be charged. It is
// a preview only: `createOrder` re-checks everything (including usage limits).
export async function quoteCoupon(raw: z.input<typeof quoteSchema>): Promise<CouponQuote> {
  if (!(await assertSameOrigin())) return { ok: false, reason: "invalid", error: "Request blocked." };
  const parsed = quoteSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "invalid", error: "That code isn't valid." };
  if (!(await withinRateLimit("coupon", 30, 600))) {
    return { ok: false, reason: "rate", error: "Too many attempts. Please wait a few minutes." };
  }
  const { code, email, items } = parsed.data;

  // Merge duplicate lines like createOrder does.
  const pick = new Map<string, { qty: number; vessel: boolean; months: number }>();
  for (const i of items) {
    const prev = pick.get(i.productId);
    pick.set(i.productId, { qty: Math.min((prev?.qty ?? 0) + i.qty, MAX_LINE_QTY), vessel: i.vessel, months: i.months });
  }
  const rows = await db
    .select()
    .from(products)
    .where(and(inArray(products.id, [...pick.keys()]), eq(products.status, "active")));
  if (rows.length !== pick.size) return { ok: false, reason: "cart", error: "Some items in your cart are no longer available." };

  try {
    const lines = rows.map((p) => priceProductRow(p, pick.get(p.id)!));
    const ev = await evaluateCoupon(
      db,
      code,
      lines.map((l) => ({ productId: l.productId, categoryId: l.categoryId, lineFils: l.grossFils, vatRate: l.vatRate })),
      email ?? "",
      new Date(),
      { lock: false },
    );
    if (!ev.ok) return { ok: false, reason: ev.code, error: ev.message, min: ev.min };
    return {
      ok: true,
      code: ev.offer.code,
      title: ev.offer.title,
      discountFils: ev.result.discountFils,
      netSubtotalFils: ev.result.lines.reduce((s, l) => s + l.netFils, 0),
      goodsVatFils: ev.result.lines.reduce((s, l) => s + l.vatFils, 0),
    };
  } catch (err) {
    if (err instanceof Reject) return { ok: false, reason: "cart", error: err.message };
    console.error("[quoteCoupon]", err);
    return { ok: false, reason: "invalid", error: "We couldn't check that code. Please try again." };
  }
}
