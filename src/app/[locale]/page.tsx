import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { MonoLabel } from "@/components/ui/mono-label";
import { buttonVariants } from "@/components/ui/button";
import { ProductCard } from "@/components/product/product-card";
import { Link } from "@/i18n/navigation";
import { getActiveProducts, getCategories, toProductCard } from "@/lib/data/products";
import { buildAlternates } from "@/lib/seo/alternates";
import { cn } from "@/lib/utils";

// Public, session-independent content (via the anon/public Supabase client)
// — safe to cache and revalidate rather than render dynamically per-request.
export const revalidate = 300;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");

  return {
    title: t("heroTitle"),
    description: t("heroSubtitle"),
    alternates: buildAlternates(locale, ""),
    openGraph: { title: t("heroTitle"), description: t("heroSubtitle") },
  };
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, pdp, categories, products] = await Promise.all([
    getTranslations("Home"),
    getTranslations("Pdp"),
    getCategories(),
    getActiveProducts({ sort: "newest", limit: 8 }),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <section className="relative flex flex-col items-start overflow-hidden">
          <Image
            src="https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=1920&q=80"
            alt=""
            fill
            priority
            quality={60}
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-(--color-ink)/60" />
          <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 pt-24 pb-32">
            <MonoLabel muted={false} className="text-(--color-mint)">
              {t("heroEyebrow")}
            </MonoLabel>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
              {t("heroTitle")}
            </h1>
            <p className="max-w-xl text-white/85">{t("heroSubtitle")}</p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link href="/shop" className={buttonVariants({ variant: "primary", size: "lg" })}>
                {t("heroCta")}
              </Link>
              <Link
                href="/corporate"
                className={cn(
                  buttonVariants({ variant: "secondary", size: "lg" }),
                  "border-white/40 bg-white/10 text-white hover:border-white/60 hover:bg-white/20",
                )}
              >
                {t("heroCtaSecondary")}
              </Link>
            </div>
          </div>
        </section>

        {categories.length > 0 && (
          <section className="mx-auto max-w-6xl px-6 pt-6 pb-20">
            <div className="grid gap-4 md:grid-cols-2">
              {categories.map((category) => (
                <Link
                  key={category.slug}
                  href={`/shop/${category.slug}`}
                  className="group relative flex aspect-[16/7] items-end overflow-hidden rounded-[2px]"
                >
                  {category.image && (
                    <Image
                      src={category.image}
                      alt={category.name}
                      fill
                      quality={75}
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
                    />
                  )}
                  <div className="absolute inset-0 bg-(--color-ink)/25" />
                  <span className="relative p-5 font-mono-label text-sm text-white">
                    {category.name}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="mb-8 flex items-baseline justify-between">
            <h2 className="text-2xl font-semibold">{t("shopCollection")}</h2>
            <Link href="/shop" className="font-mono-label text-xs text-(--color-primary)">
              {t("viewAll")}
            </Link>
          </div>
          {products.length === 0 ? (
            <p className="text-(--color-muted)">{t("emptyProducts")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={toProductCard(product)}
                  addToCartLabel={pdp("addToCart")}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
