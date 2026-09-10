import { SITE_URL } from "./site";
import type { EffectivePrice } from "@/lib/pricing";

export function productJsonLd({
  locale,
  slug,
  name,
  description,
  images,
  price,
  saleEnd,
  categoryName,
}: {
  locale: string;
  slug: string;
  name: string;
  description: string | null;
  images: { url: string }[];
  price: EffectivePrice;
  saleEnd: string | null;
  categoryName?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description: description ?? undefined,
    image: images.map((img) => img.url),
    category: categoryName ?? undefined,
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/${locale}/products/${slug}`,
      priceCurrency: "AED",
      price: price.finalPrice.toFixed(2),
      availability: "https://schema.org/InStock",
      ...(price.isOnSale && saleEnd ? { priceValidUntil: saleEnd.slice(0, 10) } : {}),
    },
  };
}
