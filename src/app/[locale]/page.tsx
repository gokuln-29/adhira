import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { MonoLabel } from "@/components/ui/mono-label";
import { buttonVariants } from "@/components/ui/button";
import { ProductCard } from "@/components/product/product-card";
import { Link } from "@/i18n/navigation";
import { getStoreSettings } from "@/lib/data/settings";
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

const DEFAULT_HERO = "https://images.unsplash.com/photo-1487070183336-b863922373d4?w=1920&q=80";

// Occasion cards reuse the admin-managed category photos, matched by slug.
// A card is skipped if the matching category doesn't exist (yet).
const OCCASIONS = [
  { slug: "weekly-flower-arrangements", title: "occOffice", body: "occOfficeBody" },
  { slug: "mixed-flowers-arrangements-for-events", title: "occEvents", body: "occEventsBody" },
  { slug: "wedding-flowers-decor", title: "occWeddings", body: "occWeddingsBody" },
  { slug: "birthday-arrangements", title: "occBirthdays", body: "occBirthdaysBody" },
] as const;

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, pdp, categories, products, rentals, settings] = await Promise.all([
    getTranslations("Home"),
    getTranslations("Pdp"),
    getCategories(),
    getActiveProducts({ sort: "newest", limit: 8 }),
    getActiveProducts({ rentalOnly: true, sort: "price-asc", limit: 4 }),
    getStoreSettings(),
  ]);

  const trust = t.raw("trust") as string[];
  const steps = t.raw("steps") as { title: string; body: string }[];
  const whys = t.raw("whys") as { title: string; body: string }[];
  const occasions = OCCASIONS.flatMap((o) => {
    const category = categories.find((c) => c.slug === o.slug);
    return category ? [{ ...o, category }] : [];
  });
  const rentalCategory = categories.find((c) => c.slug === "rental-plants");
  const rentalHref = rentalCategory ? "/shop/rental-plants" : "/shop";

  const cardLabels = {
    addToCartLabel: pdp("addToCart"),
    perMonthLabel: pdp("perMonth"),
    minOrderLabel: pdp("minOrderShort", { qty: "{qty}" }),
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero: two clear paths for two kinds of buyer */}
        <section className="relative overflow-hidden">
          <Image
            src={settings.hero_image_url ?? DEFAULT_HERO}
            alt=""
            fill
            priority
            quality={60}
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-(--color-ink)/85 via-(--color-ink)/70 to-(--color-ink)/30" />
          <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 pt-24 pb-28 md:pt-32 md:pb-36">
            <MonoLabel muted={false} className="text-(--color-mint)">
              {t("heroEyebrow")}
            </MonoLabel>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
              {t("heroTitle")}
            </h1>
            <p className="max-w-xl text-base text-white/85 md:text-lg">{t("heroSubtitle")}</p>
            <div className="flex flex-wrap gap-4 pt-2">
              <Link href="/shop" className={buttonVariants({ variant: "primary", size: "lg" })}>
                {t("heroCta")}
              </Link>
              <Link
                href="/corporate#quote"
                className={cn(
                  buttonVariants({ variant: "secondary", size: "lg" }),
                  "border-white/40 bg-white/10 text-white hover:border-white/60 hover:bg-white/20",
                )}
              >
                {t("ctaButton")}
              </Link>
            </div>
          </div>
        </section>

        {/* Trust strip */}
        <section aria-label="Highlights" className="border-b border-(--color-hairline) bg-(--color-surface)">
          <ul className="mx-auto grid max-w-6xl gap-x-8 gap-y-3 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4">
            {trust.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-(--color-primary)" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Shop by occasion */}
        {occasions.length > 0 && (
          <section className="mx-auto max-w-6xl px-6 pt-16">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold md:text-3xl">{t("occasionsTitle")}</h2>
              <p className="mt-1 text-(--color-muted)">{t("occasionsSubtitle")}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {occasions.map(({ slug, title, body, category }) => (
                <Link
                  key={slug}
                  href={`/shop/${slug}`}
                  className="group relative flex aspect-[3/4] items-end overflow-hidden rounded-[2px] bg-(--color-hairline)"
                >
                  {category.image && (
                    <Image
                      src={category.image}
                      alt=""
                      fill
                      quality={75}
                      sizes="(min-width: 1024px) 25vw, 50vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-(--color-ink)/80 via-(--color-ink)/20 to-transparent" />
                  <div className="relative flex flex-col gap-1 p-4 text-white">
                    <span className="text-base font-semibold">{t(title)}</span>
                    <span className="hidden text-sm text-white/80 sm:block">{t(body)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Rental plants */}
        <section className="mt-20 bg-(--color-surface) py-16">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-3">
            <div className="flex flex-col items-start gap-4">
              <MonoLabel muted={false} className="text-(--color-primary)">
                {t("rentalEyebrow")}
              </MonoLabel>
              <h2 className="text-2xl font-semibold md:text-3xl">{t("rentalTitle")}</h2>
              <p className="text-(--color-muted)">{t("rentalBody")}</p>
              <Link href={rentalHref} className={buttonVariants({ variant: "primary" })}>
                {t("rentalCta")}
              </Link>
            </div>
            {rentals.length > 0 && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:col-span-2">
                {rentals.slice(0, 2).map((product) => (
                  <ProductCard key={product.id} product={toProductCard(product)} {...cardLabels} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="mb-10 text-2xl font-semibold md:text-3xl">{t("howTitle")}</h2>
          <ol className="grid gap-8 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-2 border-t-2 border-(--color-primary) pt-4">
                <span className="font-mono-label text-xs text-(--color-primary)">0{i + 1}</span>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="text-(--color-muted)">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* New arrivals */}
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="mb-8 flex items-baseline justify-between">
            <h2 className="text-2xl font-semibold md:text-3xl">{t("newArrivals")}</h2>
            <Link href="/shop" className="font-mono-label text-xs text-(--color-primary)">
              {t("viewAll")}
            </Link>
          </div>
          {products.length === 0 ? (
            <p className="text-(--color-muted)">{t("emptyProducts")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
              {products.map((product, i) => (
                <ProductCard
                  key={product.id}
                  product={toProductCard(product)}
                  priority={i === 0}
                  {...cardLabels}
                />
              ))}
            </div>
          )}
        </section>

        {/* Why us */}
        <section className="border-y border-(--color-hairline) bg-(--color-surface) py-16">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="mb-10 text-2xl font-semibold md:text-3xl">{t("whyTitle")}</h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {whys.map((why) => (
                <div key={why.title} className="flex flex-col gap-2">
                  <h3 className="font-semibold">{why.title}</h3>
                  <p className="text-sm text-(--color-muted)">{why.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Browse categories */}
        {categories.length > 0 && (
          <section className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="mb-6 text-2xl font-semibold">{t("categoriesTitle")}</h2>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Link
                  key={category.slug}
                  href={`/shop/${category.slug}`}
                  className="rounded-[2px] border border-(--color-hairline) bg-(--color-surface) px-4 py-2 text-sm hover:border-(--color-primary) hover:text-(--color-primary)"
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Closing call to action */}
        <section className="bg-(--color-ink) py-16 text-white">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h2 className="text-2xl font-semibold md:text-3xl">{t("ctaTitle")}</h2>
              <p className="mt-2 text-white/75">{t("ctaBody")}</p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link href="/corporate#quote" className={buttonVariants({ variant: "primary", size: "lg" })}>
                {t("ctaButton")}
              </Link>
              <Link
                href={rentalHref}
                className={cn(
                  buttonVariants({ variant: "secondary", size: "lg" }),
                  "border-white/40 bg-transparent text-white hover:border-white/60 hover:bg-white/10",
                )}
              >
                {t("ctaSecondary")}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
