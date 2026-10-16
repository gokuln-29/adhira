import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { MonoLabel } from "@/components/ui/mono-label";
import { Reveal } from "@/components/storefront/reveal";
import { ProductCard } from "@/components/product/product-card";
import { toProductCard, type ProductSort } from "@/lib/data/products";
import type { CategoryRow, ProductRow } from "@/lib/data/types";
import { cn } from "@/lib/utils";

export function Plp({
  title,
  categories,
  activeCategorySlug,
  sort,
  tag,
  q,
  products,
  basePath,
  page = 1,
  hasMore = false,
}: {
  title: string;
  categories: CategoryRow[];
  activeCategorySlug?: string;
  sort: ProductSort;
  tag?: string;
  q?: string;
  products: ProductRow[];
  basePath: string;
  page?: number;
  hasMore?: boolean;
}) {
  const t = useTranslations("Plp");
  const locale = useLocale();
  const pdp = useTranslations("Pdp");

  const sortOptions: { value: ProductSort; label: string }[] = [
    { value: "newest", label: t("sortNewest") },
    { value: "price-asc", label: t("sortPriceAsc") },
    { value: "price-desc", label: t("sortPriceDesc") },
    { value: "name-asc", label: t("sortNameAsc") },
  ];

  const withQuery = (params: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    if (sort !== "newest") search.set("sort", sort);
    if (tag) search.set("tag", tag);
    if (q) search.set("q", q);
    // Changing sort/search restarts at page 1; only the pager passes `page`.
    search.delete("page");
    Object.entries(params).forEach(([key, value]) => {
      if (value) search.set(key, value);
      else search.delete(key);
    });
    const qs = search.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="mx-auto max-w-7xl px-6 pt-12 pb-24 md:pt-16">
      <header className="flex flex-col gap-5">
        <span className="gold-rule" />
        <h1 className="font-display text-5xl md:text-7xl">{title}</h1>
        {q && (
          <div className="flex items-center gap-3">
            <p className="text-sm text-(--color-muted)">{t("searchResultsFor", { query: q })}</p>
            <Link href={withQuery({ q: undefined })} className="font-mono-label text-[11px] text-(--color-primary)">
              {t("clearSearch")}
            </Link>
          </div>
        )}
      </header>

      {/* Category tabs: scroll sideways on phones instead of wrapping into a wall */}
      <nav
        aria-label={t("all")}
        className="-mx-6 mt-12 flex gap-8 overflow-x-auto border-b border-(--color-hairline) px-6 md:mx-0 md:px-0 [scrollbar-width:none]"
      >
        <Link
          href={activeCategorySlug ? "/shop" : withQuery({})}
          className={cn(
            "min-w-8 shrink-0 border-b-2 pb-4 text-center font-mono-label text-[11px] tracking-[0.14em] transition-colors",
            !activeCategorySlug
              ? "border-(--color-ink) text-(--color-ink)"
              : "border-transparent text-(--color-muted) hover:text-(--color-ink)",
          )}
        >
          {t("all")}
        </Link>
        {categories.map((category) => (
          <Link
            key={category.slug}
            href={`/shop/${category.slug}`}
            className={cn(
              "shrink-0 border-b-2 pb-4 font-mono-label text-[11px] tracking-[0.14em] transition-colors",
              activeCategorySlug === category.slug
                ? "border-(--color-ink) text-(--color-ink)"
                : "border-transparent text-(--color-muted) hover:text-(--color-ink)",
            )}
          >
            {category.name}
          </Link>
        ))}
      </nav>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-x-6 gap-y-2">
        <MonoLabel className="text-[10px] tracking-[0.14em]">{t("sort")}</MonoLabel>
        {sortOptions.map((opt) => (
          <Link
            key={opt.value}
            href={withQuery({ sort: opt.value === "newest" ? undefined : opt.value })}
            className={cn(
              "inline-flex min-h-8 items-center font-mono-label text-[11px] tracking-[0.1em] transition-colors",
              sort === opt.value
                ? "text-(--color-primary) underline underline-offset-8"
                : "text-(--color-muted) hover:text-(--color-ink)",
            )}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      {products.length === 0 ? (
        <div className="mt-24 flex flex-col items-center gap-3 py-16 text-center">
          <h2 className="font-display text-3xl">{t("emptyTitle")}</h2>
          <p className="max-w-sm text-sm text-(--color-muted)">{t("emptyBody")}</p>
        </div>
      ) : (
        <>
          {/* Keeps heading order sequential (h1 above, h3 product names in the
              grid below) — visually hidden, doesn't change the design. */}
          <h2 className="sr-only">{title}</h2>
          <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-14 md:grid-cols-3 md:gap-x-7 lg:grid-cols-4">
            {products.map((product, i) => (
              <Reveal key={product.id} delay={(i % 4) * 90}>
                <ProductCard
                  product={toProductCard(product, locale)}
                  addToCartLabel={pdp("addToCart")}
                  soldOutLabel={pdp("soldOut")}
                  perMonthLabel={pdp("perMonth")}
                  minOrderLabel={pdp("minOrderShort", { qty: "{qty}" })}
                  priority={i === 0}
                />
              </Reveal>
            ))}
          </div>

          {(page > 1 || hasMore) && (
            <nav aria-label={t("pagination")} className="mt-20 flex items-center justify-between border-t border-(--color-hairline) pt-8">
              {page > 1 ? (
                <Link
                  href={withQuery({ page: page > 2 ? String(page - 1) : undefined })}
                  className="font-mono-label text-xs tracking-[0.14em] text-(--color-ink) hover:text-(--color-primary)"
                >
                  ← {t("pagePrev")}
                </Link>
              ) : (
                <span />
              )}
              <MonoLabel className="text-[11px]">{t("pageNumber", { page })}</MonoLabel>
              {hasMore ? (
                <Link
                  href={withQuery({ page: String(page + 1) })}
                  className="font-mono-label text-xs tracking-[0.14em] text-(--color-ink) hover:text-(--color-primary)"
                >
                  {t("pageNext")} →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
