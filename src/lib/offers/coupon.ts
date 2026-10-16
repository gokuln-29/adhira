// Coupon maths. Pure (no server imports): the server runs it as the authority when an
// order is placed and when a code is checked; tests exercise it directly.
//
// Rules: the discount comes off the *eligible goods* (line totals before VAT, vessel
// fee included, deposits and delivery excluded). It is spread across the eligible
// lines in proportion (largest-remainder, so the pieces add up to the fils), and VAT
// is recalculated on what is left of each line, because the taxable value is the
// price actually charged.

export interface CouponTerms {
  type: "percent" | "flat";
  /** Percent (0-100) or AED. */
  value: number;
}

export interface CouponLine {
  /** Line total before VAT, before discount (fils). */
  lineFils: number;
  vatRate: number;
  eligible: boolean;
}

export interface CouponLineResult {
  discountFils: number;
  netFils: number;
  vatFils: number;
}

export interface CouponResult {
  eligibleFils: number;
  discountFils: number;
  lines: CouponLineResult[];
}

const fils = (aed: number) => Math.round(aed * 100);

export function couponDiscountFils(terms: CouponTerms, eligibleFils: number): number {
  if (eligibleFils <= 0) return 0;
  const raw = terms.type === "percent" ? Math.round((eligibleFils * terms.value) / 100) : fils(terms.value);
  return Math.max(0, Math.min(raw, eligibleFils));
}

/** Split `total` across `weights` so the parts sum to exactly `total`. */
export function allocateProportionally(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || total <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (w * total) / sum);
  const parts = exact.map(Math.floor);
  let left = total - parts.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) parts[order[k].i]++;
  return parts;
}

export function applyCoupon(terms: CouponTerms | null, lines: CouponLine[]): CouponResult {
  const eligibleIdx = lines.map((l, i) => (l.eligible ? i : -1)).filter((i) => i >= 0);
  const eligibleFils = eligibleIdx.reduce((s, i) => s + lines[i].lineFils, 0);
  const discountFils = terms ? couponDiscountFils(terms, eligibleFils) : 0;
  const shares = allocateProportionally(discountFils, eligibleIdx.map((i) => lines[i].lineFils));
  const perLine = new Map(eligibleIdx.map((lineIdx, k) => [lineIdx, shares[k]]));
  return {
    eligibleFils,
    discountFils,
    lines: lines.map((l, i) => {
      const d = perLine.get(i) ?? 0;
      const net = l.lineFils - d;
      return { discountFils: d, netFils: net, vatFils: Math.round((net * l.vatRate) / 100) };
    }),
  };
}

/** Both ends are calendar dates (YYYY-MM-DD, Dubai) and inclusive. */
export function couponWindowOpen(starts: string | null, ends: string | null, todayDubai: string): "open" | "not_started" | "expired" {
  if (starts && todayDubai < starts.slice(0, 10)) return "not_started";
  if (ends && todayDubai > ends.slice(0, 10)) return "expired";
  return "open";
}

export type CouponErrorCode = "invalid" | "not_started" | "expired" | "min_subtotal" | "not_applicable" | "used_up" | "used_by_you";
