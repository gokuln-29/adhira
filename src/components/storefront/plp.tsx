import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { MonoLabel } from "@/components/ui/mono-label";
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
}: {
  title: string;
  categories: CategoryRow[];
  activeCategorySlug?: string;
  sort: ProductSort;
  tag?: string;
  q?: string;
  products: ProductRow[];
  basePath: string;
}) {
  const t = useTranslations("Plp");
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
    Object.entries(params).forEach(([key, value]) => {
      if (value) search.set(key, value);
      else search.delete(key);
    });
    const qs = search.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>

      {q && (
        <div className="mt-3 flex items-center gap-3">
          <p className="text-sm text-(--color-muted)">
            {t("searchResultsFor", { query: q })}
          </p>
          <Link
            href={withQuery({ q: undefined })}
            className="font-mono-label text-[11px] text-(--color-primary)"
          >
            {t("clearSearch")}
          </Link>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <Link
          href={activeCategorySlug ? "/shop" : withQuery({})}
          className={cn(
            "rounded-[2px] border px-3 py-1.5 font-mono-label text-[11px]",
            !activeCategorySlug
              ? "border-(--color-primary) text-(--color-primary)"
              : "border-(--color-hairline) text-(--color-muted) hover:text-(--color-ink)",
          )}
        >
          {t("all")}
        </Link>
        {categories.map((category) => (
          <Link
            key={category.slug}
            href={`/shop/${category.slug}`}
            className={cn(
              "rounded-[2px] border px-3 py-1.5 font-mono-label text-[11px]",
              activeCategorySlug === category.slug
                ? "border-(--color-primary) text-(--color-primary)"
                : "border-(--color-hairline) text-(--color-muted) hover:text-(--color-ink)",
            )}
          >
            {category.name}
          </Link>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-(--color-hairline) pt-4">
        <MonoLabel className="me-2 text-[10px]">{t("sort")}</MonoLabel>
        {sortOptions.map((opt) => (
          <Link
            key={opt.value}
            href={withQuery({ sort: opt.value === "newest" ? undefined : opt.value })}
            className={cn(
              "font-mono-label text-[11px]",
              sort === opt.value
                ? "text-(--color-primary)"
                : "text-(--color-muted) hover:text-(--color-ink)",
            )}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      {products.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-2 py-16 text-center">
          <MonoLabel muted={false}>{t("emptyTitle")}</MonoLabel>
          <p className="max-w-sm text-sm text-(--color-muted)">{t("emptyBody")}</p>
        </div>
      ) : (
        <>
          {/* Keeps heading order sequential (h1 above, h3 product names in the
              grid below) — visually hidden, doesn't change the design. */}
          <h2 className="sr-only">{title}</h2>
          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product, i) => (
              <ProductCard
                key={product.id}
                product={toProductCard(product)}
                addToCartLabel={pdp("addToCart")}
                priority={i === 0}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
