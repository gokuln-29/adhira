export type DiscountType = "percent" | "flat" | null;

export interface PricedProduct {
  base_price: number;
  discount_type: DiscountType;
  discount_value: number | null;
  sale_start: string | null;
  sale_end: string | null;
  vat_rate: number;
}

export interface EffectivePrice {
  finalPrice: number;
  originalPrice: number | null;
  isOnSale: boolean;
  discountLabel: string | null;
  vatRate: number;
}

export function isSaleActive(product: PricedProduct, now = new Date()): boolean {
  if (!product.discount_type || product.discount_value == null) return false;
  if (product.sale_start && now < new Date(product.sale_start)) return false;
  if (product.sale_end && now > new Date(product.sale_end)) return false;
  return true;
}

export function getEffectivePrice(
  product: PricedProduct,
  now = new Date(),
): EffectivePrice {
  const base = product.base_price;

  if (!isSaleActive(product, now)) {
    return {
      finalPrice: base,
      originalPrice: null,
      isOnSale: false,
      discountLabel: null,
      vatRate: product.vat_rate,
    };
  }

  const value = product.discount_value!;
  const finalPrice =
    product.discount_type === "percent"
      ? base * (1 - value / 100)
      : Math.max(base - value, 0);

  const discountLabel =
    product.discount_type === "percent" ? `${value}% OFF` : `AED ${formatAmount(value)} OFF`;

  return {
    finalPrice: Math.round(finalPrice * 100) / 100,
    originalPrice: base,
    isOnSale: true,
    discountLabel,
    vatRate: product.vat_rate,
  };
}

export function formatAmount(amount: number): string {
  return amount.toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatAED(amount: number): string {
  return `AED ${formatAmount(amount)}`;
}

export function vatNote(vatRate: number): string {
  // Prices are stored and shown VAT-exclusive; VAT is added at checkout.
  return `+ ${vatRate}% VAT`;
}

// ---------------------------------------------------------------------------
// Product rules: minimums, glass vessel, rental. Pure functions shared by the
// browser (cart display) and the server (`createOrder`, which is the only
// authority on what actually gets charged).
// ---------------------------------------------------------------------------

export interface ProductRules {
  min_order_qty: number;
  min_order_value: number;
  allows_vessel: boolean;
  vessel_price: number;
  vessel_deposit: number;
  is_rental: boolean;
  rental_monthly_price: number | null;
  rental_min_months: number;
  rental_deposit: number;
}

export const DEFAULT_RULES: ProductRules = {
  min_order_qty: 1,
  min_order_value: 0,
  allows_vessel: false,
  vessel_price: 0,
  vessel_deposit: 0,
  is_rental: false,
  rental_monthly_price: null,
  rental_min_months: 1,
  rental_deposit: 0,
};

export const MAX_RENTAL_MONTHS = 60;

export interface LineSelection {
  qty: number;
  /** Customer ticked "include glass vessel" (ignored unless the product allows it). */
  vessel: boolean;
  /** Rental length in months (ignored unless the product is a rental). */
  months: number;
}

export type LineProblem =
  | { code: "min_qty"; min: number }
  | { code: "min_value"; min: number }
  | { code: "min_months"; min: number };

export interface LinePrice {
  /** Price of one unit: sale price for purchases, monthly x months for rentals. */
  unitFils: number;
  /** unit x qty (the "goods" value used for the minimum-order-value check). */
  goodsFils: number;
  vesselFils: number;
  /** Goods + vessel: the VAT-able subtotal contribution. */
  lineFils: number;
  vatFils: number;
  /** Refundable deposits (vessel + rental). Not subject to VAT. */
  depositFils: number;
  problems: LineProblem[];
  isRental: boolean;
  /** Effective selections after applying the product's rules. */
  vessel: boolean;
  months: number;
}

const fils = (aed: number) => Math.round(aed * 100);

// All money is computed in whole fils (integers) so totals never drift.
export function priceLine(
  product: PricedProduct & ProductRules,
  selection: LineSelection,
  now = new Date(),
): LinePrice {
  const qty = Math.max(1, Math.floor(selection.qty));
  const isRental = product.is_rental && (product.rental_monthly_price ?? 0) > 0;
  const months = isRental
    ? Math.min(Math.max(Math.floor(selection.months) || 1, 1), MAX_RENTAL_MONTHS)
    : 0;
  const vessel = product.allows_vessel && selection.vessel;

  const unitFils = isRental
    ? fils(product.rental_monthly_price ?? 0) * months
    : fils(getEffectivePrice(product, now).finalPrice);
  const goodsFils = unitFils * qty;
  const vesselFils = vessel ? fils(product.vessel_price) * qty : 0;
  const lineFils = goodsFils + vesselFils;
  const vatFils = Math.round((lineFils * product.vat_rate) / 100);
  const depositFils =
    (vessel ? fils(product.vessel_deposit) * qty : 0) +
    (isRental ? fils(product.rental_deposit) * qty : 0);

  const problems: LineProblem[] = [];
  if (qty < product.min_order_qty) problems.push({ code: "min_qty", min: product.min_order_qty });
  if (goodsFils < fils(product.min_order_value)) {
    problems.push({ code: "min_value", min: product.min_order_value });
  }
  if (isRental && months < product.rental_min_months) {
    problems.push({ code: "min_months", min: product.rental_min_months });
  }

  return { unitFils, goodsFils, vesselFils, lineFils, vatFils, depositFils, problems, isRental, vessel, months };
}

// Smallest quantity that satisfies BOTH the minimum quantity and the minimum
// order value, so the "add to cart" form can start from a valid number.
export function effectiveMinQty(
  product: PricedProduct & ProductRules,
  months = product.rental_min_months,
  now = new Date(),
): number {
  const unitFils = priceLine(product, { qty: 1, vessel: false, months }, now).unitFils;
  const byValue = unitFils > 0 ? Math.ceil(fils(product.min_order_value) / unitFils) : 1;
  return Math.max(product.min_order_qty, byValue, 1);
}

const MONTH_STEPS = [1, 2, 3, 4, 5, 6, 9, 12, 18, 24, 36];

// Rental lengths offered in the dropdown: never below the product's minimum,
// and always including the length already chosen.
export function rentalMonthChoices(minMonths: number, current?: number): number[] {
  const set = new Set(MONTH_STEPS.filter((m) => m >= minMonths));
  set.add(minMonths);
  if (current && current >= minMonths) set.add(current);
  return [...set].sort((a, b) => a - b);
}
