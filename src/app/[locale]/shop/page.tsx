import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localizeCategory } from "@/lib/data/localize";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { Plp } from "@/components/storefront/plp";
import { getActiveProducts, PAGE_SIZE, type ProductSort } from "@/lib/data/products";
import { getCategories } from "@/lib/data/products";
import { buildAlternates } from "@/lib/seo/alternates";

export const revalidate = 300;

const validSorts: ProductSort[] = ["newest", "price-asc", "price-desc", "name-asc"];
const DESCRIPTION =
  "Flower arrangements, indoor plants and corporate gifting for offices across the UAE — browse the full collection.";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/shop">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  return {
    title: "Shop",
    description: DESCRIPTION,
    alternates: buildAlternates(locale, "/shop"),
    openGraph: { title: "Shop", description: DESCRIPTION },
  };
}

export default async function ShopPage({
  params: paramsPromise,
  searchParams,
}: PageProps<"/[locale]/shop">) {
  const { locale } = await paramsPromise;
  setRequestLocale(locale);
  const params = await searchParams;
  const sortParam = Array.isArray(params.sort) ? params.sort[0] : params.sort;
  const tagParam = Array.isArray(params.tag) ? params.tag[0] : params.tag;
  const qParam = Array.isArray(params.q) ? params.q[0] : params.q;
  const pageRaw = Number(Array.isArray(params.page) ? params.page[0] : params.page);
  const page = Number.isInteger(pageRaw) && pageRaw > 0 && pageRaw <= 500 ? pageRaw : 1;
  const sort: ProductSort = validSorts.includes(sortParam as ProductSort)
    ? (sortParam as ProductSort)
    : "newest";

  const [rawCategories, products, t, b] = await Promise.all([
    getCategories(),
    getActiveProducts({
      sort,
      tag: tagParam,
      q: qParam,
      limit: PAGE_SIZE + 1,
      offset: (page - 1) * PAGE_SIZE,
    }),
    getTranslations("Plp"),
    getTranslations("Breadcrumbs"),
  ]);

  const categories = rawCategories.map((c) => localizeCategory(c, locale));

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <Breadcrumbs items={[{ label: b("home"), href: "/" }, { label: b("shop") }]} />
      <main className="flex-1">
        <Plp
          title={t("shopTitle")}
          categories={categories}
          sort={sort}
          tag={tagParam}
          q={qParam}
          products={products.slice(0, PAGE_SIZE)}
          page={page}
          hasMore={products.length > PAGE_SIZE}
          basePath="/shop"
        />
      </main>
      <Footer />
    </div>
  );
}
