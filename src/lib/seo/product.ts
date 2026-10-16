import { SITE_NAME, SITE_URL } from "./site";
import type { EffectivePrice } from "@/lib/pricing";

// Product structured data (Google "Product snippets"). Google requires the markup to match
// what the page shows, so rentals use the monthly price (not the purchase price) and the
// availability follows tracked stock. Prices on the site exclude VAT, which the markup says.
export function productJsonLd({
  locale,
  slug,
  name,
  description,
  images,
  price,
  saleEnd,
  categoryName,
  soldOut = false,
  rentalMonthlyPrice = null,
}: {
  locale: string;
  slug: string;
  name: string;
  description: string | null;
  images: { url: string }[];
  price: EffectivePrice;
  saleEnd: string | null;
  categoryName?: string | null;
  soldOut?: boolean;
  /** Set for rental products: the displayed price is per month. */
  rentalMonthlyPrice?: number | null;
}) {
  const isRental = rentalMonthlyPrice != null && rentalMonthlyPrice > 0;
  const amount = (isRental ? rentalMonthlyPrice : price.finalPrice).toFixed(2);
  const url = `${SITE_URL}/${locale}/products/${slug}`;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description: description ?? undefined,
    ...(images.length > 0 ? { image: images.map((img) => img.url) } : {}),
    sku: slug,
    brand: { "@type": "Brand", name: SITE_NAME },
    category: categoryName ?? undefined,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "AED",
      price: amount,
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: amount,
        priceCurrency: "AED",
        valueAddedTaxIncluded: false,
        ...(isRental ? { unitCode: "MON", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" } } : {}),
      },
      availability: soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
      ...(!isRental && price.isOnSale && saleEnd ? { priceValidUntil: saleEnd.slice(0, 10) } : {}),
    },
  };
}
