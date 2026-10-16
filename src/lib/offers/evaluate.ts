import "server-only";
import { eq, sql } from "drizzle-orm";
import type { Db, Tx } from "@/lib/db";
import { offer_targets, offers } from "@/lib/db/schema";
import { dubaiNow } from "@/lib/delivery/rules";
import { applyCoupon, couponWindowOpen, type CouponErrorCode, type CouponResult } from "@/lib/offers/coupon";

export interface CouponCartLine {
  productId: string;
  categoryId: string | null;
  /** Before VAT, before discount, fils. */
  lineFils: number;
  vatRate: number;
}

export type CouponEvaluation =
  | {
      ok: true;
      offer: { id: string; code: string; title: string; type: "percent" | "flat"; value: number };
      result: CouponResult;
    }
  | { ok: false; code: CouponErrorCode; message: string; min?: number };

const MESSAGES: Record<CouponErrorCode, string> = {
  invalid: "That code isn't valid.",
  not_started: "That code isn't active yet.",
  expired: "That code has expired.",
  min_subtotal: "Your order is below the minimum for this code.",
  not_applicable: "That code doesn't apply to the items in your cart.",
  used_up: "That code has been fully used.",
  used_by_you: "You've already used that code.",
};

const fail = (code: CouponErrorCode, min?: number): CouponEvaluation => ({
  ok: false,
  code,
  message: code === "min_subtotal" && min != null ? `Spend at least AED ${min.toFixed(2)} (before VAT) on eligible items to use this code.` : MESSAGES[code],
  min,
});

/**
 * Checks a code against a cart and works out the discount.
 * With `lock` (inside the order transaction) the offer row is locked FOR UPDATE and the
 * usage counts are read with locking reads, so two simultaneous checkouts can't both
 * take the last redemption.
 */
export async function evaluateCoupon(
  client: Db | Tx,
  rawCode: string,
  lines: CouponCartLine[],
  email: string,
  now: Date,
  opts: { lock: boolean },
): Promise<CouponEvaluation> {
  const code = rawCode.trim().toUpperCase();
  if (!code || code.length > 40) return fail("invalid");

  const q = client.select().from(offers).where(eq(offers.code, code)).limit(1);
  const offer = (await (opts.lock ? q.for("update") : q))[0];
  // Unknown, switched off, or not a discount type: one answer, so codes can't be probed.
  if (!offer || !offer.active || (offer.type !== "percent" && offer.type !== "flat") || offer.value <= 0) return fail("invalid");

  const window = couponWindowOpen(offer.starts, offer.ends, dubaiNow(now).date);
  if (window !== "open") return fail(window);

  let eligibleFor: (l: CouponCartLine) => boolean = () => true;
  if (offer.scope === "category" || offer.scope === "product") {
    const targets = await client.select().from(offer_targets).where(eq(offer_targets.offer_id, offer.id));
    const ids = new Set(targets.filter((t) => t.kind === offer.scope).map((t) => t.target_id));
    eligibleFor = offer.scope === "category" ? (l) => !!l.categoryId && ids.has(l.categoryId) : (l) => ids.has(l.productId);
  }

  const result = applyCoupon(
    { type: offer.type, value: offer.value },
    lines.map((l) => ({ lineFils: l.lineFils, vatRate: l.vatRate, eligible: eligibleFor(l) })),
  );
  if (result.eligibleFils === 0 || result.discountFils === 0) return fail("not_applicable");
  if (offer.min_subtotal > 0 && result.eligibleFils < Math.round(offer.min_subtotal * 100)) return fail("min_subtotal", offer.min_subtotal);

  // Cancelled orders give their redemption back; everything else counts.
  const countUses = async (byEmail: boolean): Promise<number> => {
    const rows = await client.execute(
      sql`SELECT COUNT(*) AS n FROM offer_redemptions r JOIN orders o ON o.id = r.order_id
          WHERE r.offer_id = ${offer.id} AND o.status <> 'cancelled' ${byEmail ? sql`AND r.customer_email = ${email.trim()}` : sql``}
          ${opts.lock ? sql`FOR SHARE` : sql``}`,
    );
    return Number((rows as unknown as [{ n: number | string }[]])[0][0].n);
  };
  if (offer.max_uses != null && (await countUses(false)) >= offer.max_uses) return fail("used_up");
  if (offer.max_uses_per_customer != null && email && (await countUses(true)) >= offer.max_uses_per_customer) return fail("used_by_you");

  return { ok: true, offer: { id: offer.id, code: offer.code!, title: offer.title, type: offer.type, value: offer.value }, result };
}

