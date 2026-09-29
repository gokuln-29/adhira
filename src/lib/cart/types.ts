import type { PricedProduct, ProductRules } from "@/lib/pricing";

// Carries the product's pricing rules so the cart can show live totals and
// minimum warnings. This is display-only: `createOrder` re-reads every rule
// and price from the database.
export interface CartLineItem extends PricedProduct, ProductRules {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  qty: number;
  /** "Include glass vessel" chosen by the customer. */
  vessel: boolean;
  /** Rental length in months (rental products only). */
  months: number;
}
