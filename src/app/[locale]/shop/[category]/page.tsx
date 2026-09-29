import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { Plp } from "@/components/storefront/plp";
import {
  getActiveProducts,
  getCategories,
  getCategoryBySlug,
  PAGE_SIZE,
  type ProductSort,
} from "@/lib/data/products";
import { buildAlternates } from "@/lib/seo/alternates";

export const revalidate = 300;

const validSorts: ProductSort[] = ["newest", "price-asc", "price-desc", "name-asc"];

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/shop/[category]">): Promise<Metadata> {
  const { locale, category: categorySlug } = await params;
  setRequestLocale(locale);
  const category = await getCategoryBySlug(categorySlug);
  if (!category) return {};

  const description = `${category.name} for offices across Dubai, Abu Dhabi and Sharjah.`;

  return {
    title: category.name,
    description,
    alternates: buildAlternates(locale, `/shop/${categorySlug}`),
    openGraph: {
      title: category.name,
      description,
      images: category.image ? [category.image] : undefined,
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<"/[locale]/shop/[category]">) {
  const { locale, category: categorySlug } = await params;
  setRequestLocale(locale);
  const search = await searchParams;

  const category = await getCategoryBySlug(categorySlug);
  if (!category) notFound();

  const sortParam = Array.isArray(search.sort) ? search.sort[0] : search.sort;
  const pageParam = Number(Array.isArray(search.page) ? search.page[0] : search.page);
  const page = Number.isInteger(pageParam) && pageParam > 0 && pageParam <= 500 ? pageParam : 1;
  const sort: ProductSort = validSorts.includes(sortParam as ProductSort)
    ? (sortParam as ProductSort)
    : "newest";

  const [categories, products, b] = await Promise.all([
    getCategories(),
    getActiveProducts({ categorySlug, sort, limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE }),
    getTranslations("Breadcrumbs"),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <Breadcrumbs
        items={[
          { label: b("home"), href: "/" },
          { label: b("shop"), href: "/shop" },
          { label: category.name },
        ]}
      />
      <main className="flex-1">
        <Plp
          title={category.name}
          categories={categories}
          activeCategorySlug={category.slug}
          sort={sort}
          products={products.slice(0, PAGE_SIZE)}
          page={page}
          hasMore={products.length > PAGE_SIZE}
          basePath={`/shop/${category.slug}`}
        />
      </main>
      <Footer />
    </div>
  );
}
