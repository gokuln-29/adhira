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
  return `incl. ${vatRate}% VAT`;
}
