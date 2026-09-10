import type { PricedProduct } from "@/lib/pricing";

export interface CartLineItem extends PricedProduct {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  qty: number;
}
