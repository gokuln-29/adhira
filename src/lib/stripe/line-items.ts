// Builds the Stripe Checkout line items for an order. Pure, so a test can prove the
// sum Stripe will charge equals `orders.total` (the webhook rejects anything else).
export interface StripeLineInput {
  name: string;
  qty: number;
  unitFils: number;
  isRental: boolean;
  months: number;
  vessel: boolean;
  vesselUnitFils: number;
  /** Line total before VAT AFTER any coupon (goods + vessel). */
  lineFils: number;
  /** Coupon discount taken off this line. */
  discountFils: number;
}

export interface StripeLineItem {
  price_data: { currency: "aed"; product_data: { name: string }; unit_amount: number };
  quantity: number;
}

const item = (name: string, unit_amount: number, quantity = 1): StripeLineItem => ({
  price_data: { currency: "aed", product_data: { name }, unit_amount },
  quantity,
});

export function buildStripeLineItems(input: {
  lines: StripeLineInput[];
  deliveryFils: number;
  /** Total VAT on the order: goods + delivery. */
  vatFils: number;
  depositFils: number;
}): StripeLineItem[] {
  return [
    // Stripe has no negative lines, so a discounted line is sent as ONE line at its net
    // price (quantity 1) instead of unit price x qty.
    ...input.lines
      .filter((l) => l.discountFils > 0)
      .map((l) => item(`${l.name} × ${l.qty}${l.vessel ? " with glass vessel" : ""}${l.isRental ? ` (rental, ${l.months} months)` : ""} (discount applied)`, l.lineFils)),
    ...input.lines
      .filter((l) => l.discountFils === 0)
      .map((l) => item(l.isRental ? `${l.name} (rental, ${l.months} months)` : l.name, l.unitFils, l.qty)),
    ...input.lines.filter((l) => l.vessel && l.discountFils === 0).map((l) => item(`Glass vessel: ${l.name}`, l.vesselUnitFils, l.qty)),
    // Prices are stored VAT-exclusive with VAT broken out separately, so it needs its
    // own line for the charge to match `orders.total`.
    item("Delivery", input.deliveryFils),
    item("VAT", input.vatFils),
    item("Refundable deposit", input.depositFils),
  ].filter((l) => l.price_data.unit_amount > 0);
}

export const stripeTotalFils = (items: StripeLineItem[]) =>
  items.reduce((sum, i) => sum + i.price_data.unit_amount * i.quantity, 0);
