import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { MonoLabel } from "@/components/ui/mono-label";
import { buttonVariants } from "@/components/ui/button";
import {
  formatAED,
  getEffectivePrice,
  vatNote,
  type PricedProduct,
  type ProductRules,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";

export interface ProductCardDetail {
  label: string;
  value: string;
}

export interface ProductCardData extends PricedProduct, Partial<ProductRules> {
  name: string;
  slug: string;
  short_description: string | null;
  details: ProductCardDetail[];
  image: { url: string; alt: string } | null;
}

export function ProductCard({
  product,
  className,
  navigable = true,
  addToCartLabel = "Add to cart",
  priority = false,
  perMonthLabel = "/ month",
  minOrderLabel = "Min. {qty}",
}: {
  product: ProductCardData;
  className?: string;
  /** Set false outside the `[locale]` tree (e.g. the admin live preview) — the
   * next-intl `Link` needs an intl context this component doesn't provide. */
  navigable?: boolean;
  /** Same reason as `navigable`: this component has no intl context of its
   * own (the admin preview doesn't have one), so callers pass the translated
   * string in rather than this component calling `useTranslations` itself. */
  addToCartLabel?: string;
  /** Set true for the first card in an above-the-fold grid (PLP, home) so
   * it's not lazy-loaded — it's typically the LCP element there. */
  priority?: boolean;
  /** Translated by the caller for the same no-intl-context reason as above. */
  perMonthLabel?: string;
  minOrderLabel?: string;
}) {
  const price = getEffectivePrice(product);
  const isRental = !!product.is_rental && (product.rental_monthly_price ?? 0) > 0;
  const detailsLine = product.details
    .map((d) => `${d.label}: ${d.value}`)
    .join(" · ");

  const content = (
    <>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[2px] bg-(--color-hairline)/40">
        {product.image ? (
          <Image
            src={product.image.url}
            alt={product.image.alt}
            fill
            priority={priority}
            quality={priority ? 60 : 75}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : null}

        {!isRental && price.isOnSale && price.discountLabel && (
          <span className="absolute start-3 top-3 rounded-[2px] bg-(--color-primary) px-2 py-1 font-mono-label text-[10px] text-white">
            {price.discountLabel}
          </span>
        )}

        <div className="absolute inset-x-3 bottom-3 translate-y-2 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0">
          <span className={buttonVariants({ variant: "primary", size: "sm", className: "w-full" })}>
            {addToCartLabel}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 pt-3">
        <h3 className="text-sm font-semibold text-(--color-ink)">{product.name}</h3>
        {product.short_description && (
          <p className="line-clamp-1 text-sm text-(--color-muted)">
            {product.short_description}
          </p>
        )}
        {detailsLine && (
          <MonoLabel as="p" className="line-clamp-1">
            {detailsLine}
          </MonoLabel>
        )}
        <div className="flex items-baseline gap-2 pt-1">
          <MonoLabel muted={false}>
            {isRental
              ? `${formatAED(product.rental_monthly_price ?? 0)} ${perMonthLabel}`
              : formatAED(price.finalPrice)}
          </MonoLabel>
          {!isRental && price.isOnSale && price.originalPrice && (
            <MonoLabel className="line-through">
              {formatAED(price.originalPrice)}
            </MonoLabel>
          )}
        </div>
        <MonoLabel className="text-[10px]">
          {vatNote(price.vatRate)}
          {(product.min_order_qty ?? 1) > 1 && ` · ${minOrderLabel.replace("{qty}", String(product.min_order_qty))}`}
        </MonoLabel>
      </div>
    </>
  );

  if (!navigable) {
    return <div className={cn("group flex flex-col", className)}>{content}</div>;
  }

  return (
    <Link href={`/products/${product.slug}`} className={cn("group flex flex-col", className)}>
      {content}
    </Link>
  );
}
