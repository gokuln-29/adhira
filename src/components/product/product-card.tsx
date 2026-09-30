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
  image2?: { url: string; alt: string } | null;
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
      <div className="relative aspect-[4/5] overflow-hidden bg-(--color-hairline)/50">
        {product.image ? (
          <Image
            src={product.image.url}
            alt={product.image.alt}
            fill
            priority={priority}
            quality={priority ? 65 : 75}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-[transform,opacity] duration-[900ms] ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : null}
        {product.image2 && (
          <Image
            src={product.image2.url}
            alt=""
            fill
            quality={70}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover opacity-0 transition-opacity duration-700 ease-out group-hover:opacity-100 motion-reduce:transition-none"
          />
        )}

        {!isRental && price.isOnSale && price.discountLabel && (
          <span className="absolute start-3 top-3 bg-(--color-surface) px-2.5 py-1 font-mono-label text-[10px] tracking-[0.12em] text-(--color-ink)">
            {price.discountLabel}
          </span>
        )}

        <div className="absolute inset-x-3 bottom-3 translate-y-3 opacity-0 transition-all duration-500 ease-out group-hover:translate-y-0 group-hover:opacity-100 motion-reduce:translate-y-0 motion-reduce:opacity-100">
          <span className={buttonVariants({ variant: "primary", size: "sm", className: "w-full backdrop-blur" })}>
            {addToCartLabel}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-4">
        <h3 className="font-display text-[1.35rem] leading-tight text-(--color-ink) transition-colors group-hover:text-(--color-primary)">
          {product.name}
        </h3>
        {product.short_description && (
          <p className="line-clamp-1 text-sm text-(--color-muted)">{product.short_description}</p>
        )}
        {detailsLine && (
          <MonoLabel as="p" className="line-clamp-1 text-[10px] tracking-[0.1em]">
            {detailsLine}
          </MonoLabel>
        )}
        <div className="flex items-baseline gap-2 pt-1">
          <MonoLabel muted={false} className="text-[13px]">
            {isRental
              ? `${formatAED(product.rental_monthly_price ?? 0)} ${perMonthLabel}`
              : formatAED(price.finalPrice)}
          </MonoLabel>
          {!isRental && price.isOnSale && price.originalPrice && (
            <MonoLabel className="text-[12px] line-through">{formatAED(price.originalPrice)}</MonoLabel>
          )}
        </div>
        <MonoLabel className="text-[10px] tracking-[0.1em]">
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
