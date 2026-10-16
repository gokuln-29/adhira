import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { buttonVariants } from "@/components/ui/button";
import { OccasionCard } from "@/components/storefront/occasion-card";
import { Reveal } from "@/components/storefront/reveal";
import { ProductCard } from "@/components/product/product-card";
import { Link } from "@/i18n/navigation";
import { localizeCategory } from "@/lib/data/localize";
import { getStoreSettings } from "@/lib/data/settings";
import { getActiveProducts, getCategories, toProductCard } from "@/lib/data/products";
import { buildAlternates } from "@/lib/seo/alternates";
import { cn } from "@/lib/utils";

// Public, session-independent content (read from MySQL without touching cookies)
// — safe to cache and revalidate rather than render dynamically per-request.
export const revalidate = 300;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: buildAlternates(locale, ""),
    openGraph: { title: t("metaTitle"), description: t("metaDescription") },
  };
}

const DEFAULT_HERO = "https://images.unsplash.com/photo-1487070183336-b863922373d4?w=1920&q=80";

// Occasion cards reuse the admin-managed category photos, matched by slug. A
// card is skipped if its category doesn't exist (yet).
const OCCASIONS = [
  { slug: "weekly-flower-arrangements", title: "occOffice", body: "occOfficeBody" },
  { slug: "mixed-flowers-arrangements-for-events", title: "occEvents", body: "occEventsBody" },
  { slug: "wedding-flowers-decor", title: "occWeddings", body: "occWeddingsBody" },
  { slug: "birthday-arrangements", title: "occBirthdays", body: "occBirthdaysBody" },
] as const;

function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono-label text-[11px] tracking-[0.18em] text-(--color-primary)", className)}>
      {children}
    </span>
  );
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, pdp, rawCategories, products, rentals, settings] = await Promise.all([
    getTranslations("Home"),
    getTranslations("Pdp"),
    getCategories(),
    getActiveProducts({ sort: "newest", limit: 4 }),
    getActiveProducts({ rentalOnly: true, sort: "price-asc", limit: 1 }),
    getStoreSettings(),
  ]);

  const categories = rawCategories.map((c) => localizeCategory(c, locale));

  // Each occasion shows several photos: the category photo first, then the
  // main photos of its newest products (already uploaded, so no extra admin work).
  const occasionProducts = await Promise.all(
    OCCASIONS.map((o) => getActiveProducts({ categorySlug: o.slug, sort: "newest", limit: 6 })),
  );
  const occasionImages = OCCASIONS.map((o, i) => {
    const category = categories.find((c) => c.slug === o.slug);
    const fromProducts = occasionProducts[i].flatMap((p) => {
      const main = p.product_images.find((img) => img.is_primary) ?? p.product_images[0];
      return main ? [main.url] : [];
    });
    return [...new Set([category?.image, ...fromProducts].filter((u): u is string => !!u))].slice(0, 5);
  });
  const trust = t.raw("trust") as { title: string; body: string }[];
  const steps = t.raw("steps") as { title: string; body: string }[];
  const rentalPoints = t.raw("rentalPoints") as string[];
  const occasions = OCCASIONS.flatMap((o) => {
    const category = categories.find((c) => c.slug === o.slug);
    return category ? [{ ...o, category }] : [];
  });
  const rentalCategory = categories.find((c) => c.slug === "rental-plants");
  const rentalHref = rentalCategory ? "/shop/rental-plants" : "/shop";
  const rentalImage =
    rentalCategory?.image ??
    rentals[0]?.product_images.find((i) => i.is_primary)?.url ??
    rentals[0]?.product_images[0]?.url ??
    null;

  const cardLabels = {
    addToCartLabel: pdp("addToCart"),
    perMonthLabel: pdp("perMonth"),
    minOrderLabel: pdp("minOrderShort", { qty: "{qty}" }),
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* HERO: one image, one sentence, one clear action */}
        <section className="relative isolate flex min-h-[78vh] items-end overflow-hidden md:min-h-[86vh]">
          <Image
            src={settings.hero_image_url ?? DEFAULT_HERO}
            alt=""
            fill
            priority
            quality={65}
            sizes="100vw"
            className="-z-10 object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-(--color-ink)/85 via-(--color-ink)/35 to-(--color-ink)/10" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-(--color-ink)/60 via-(--color-ink)/20 to-transparent rtl:bg-gradient-to-l" />
          <div className="mx-auto w-full max-w-6xl px-6 pb-16 md:pb-24">
            <Eyebrow className="text-(--color-mint)">{t("heroEyebrow")}</Eyebrow>
            <h1 className="font-display mt-5 max-w-3xl text-5xl text-white md:text-7xl">
              {t("heroHeadline")}
            </h1>
            <p className="mt-6 max-w-xl text-base text-white/85 md:text-lg">{t("heroLead")}</p>
            <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
              <Link href="/shop" className={buttonVariants({ variant: "primary", size: "lg" })}>
                {t("heroCta")}
              </Link>
              <Link
                href="/corporate#quote"
                className="font-mono-label text-xs text-white underline decoration-white/40 underline-offset-8 transition-colors hover:decoration-white"
              >
                {t("heroLink")} <span aria-hidden="true" className="inline-block rtl:rotate-180">→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* TRUST: three quiet facts, no icons or boxes */}
        <section aria-label={t("heroEyebrow")} className="border-b border-(--color-hairline) bg-(--color-surface)">
          <div className="mx-auto grid max-w-6xl divide-y divide-(--color-hairline) px-6 md:grid-cols-3 md:divide-x md:divide-y-0 rtl:md:divide-x-reverse">
            {trust.map((item) => (
              <div key={item.title} className="py-7 md:px-8 md:first:ps-0 md:last:pe-0">
                <p className="font-mono-label text-[11px] tracking-[0.14em]">{item.title}</p>
                <p className="mt-2 text-sm text-(--color-muted)">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* COLLECTIONS */}
        {occasions.length > 0 && (
          <section className="mx-auto max-w-6xl px-6 py-24 md:py-32">
            <Reveal>
              <div className="mb-12 flex flex-col gap-6 md:mb-16 md:flex-row md:items-end md:justify-between">
                <div className="flex flex-col gap-3">
                  <Eyebrow>{t("collectionsEyebrow")}</Eyebrow>
                  <h2 className="font-display text-4xl md:text-6xl">{t("collectionsTitle")}</h2>
                </div>
                <p className="max-w-sm text-(--color-muted)">{t("collectionsLead")}</p>
              </div>
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2 md:gap-6">
              {occasions.map(({ slug, title, body }, i) => {
                const images = occasionImages[OCCASIONS.findIndex((o) => o.slug === slug)];
                return (
                  <Reveal key={slug} delay={(i % 2) * 140}>
                    <OccasionCard
                      href={`/shop/${slug}`}
                      title={t(title)}
                      body={t(body)}
                      cta={t("shopNow")}
                      images={images}
                      index={i}
                    />
                  </Reveal>
                );
              })}
            </div>
          </section>
        )}

        {/* NEW ARRIVALS */}
        <section className="bg-(--color-surface) py-24 md:py-32">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-12 flex items-end justify-between gap-6 md:mb-16">
              <div className="flex flex-col gap-3">
                <Eyebrow>{t("newArrivalsEyebrow")}</Eyebrow>
                <h2 className="font-display text-4xl md:text-6xl">{t("newArrivals")}</h2>
              </div>
              <Link href="/shop" className="font-mono-label inline-block shrink-0 py-2 text-xs text-(--color-primary) underline-offset-8 hover:underline">
                {t("viewAll")} <span aria-hidden="true" className="inline-block rtl:rotate-180">→</span>
              </Link>
            </div>
            {products.length === 0 ? (
              <p className="text-(--color-muted)">{t("emptyProducts")}</p>
            ) : (
              <div className="grid grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-4 md:gap-x-6">
                {products.map((product, i) => (
                  <ProductCard
                    key={product.id}
                    product={toProductCard(product, locale)}
                    priority={i === 0}
                    {...cardLabels}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* RENTAL: one calm split feature */}
        <section className="grid md:grid-cols-2">
          <div className="relative min-h-[360px] bg-(--color-hairline) md:min-h-[560px]">
            {rentalImage && (
              <Image
                src={rentalImage}
                alt=""
                fill
                quality={75}
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
            )}
          </div>
          <div className="flex flex-col items-start justify-center gap-6 bg-(--color-canvas) px-6 py-16 md:px-16 md:py-24">
            <Eyebrow>{t("rentalEyebrow")}</Eyebrow>
            <h2 className="font-display text-4xl md:text-5xl">{t("rentalTitle")}</h2>
            <p className="max-w-md text-(--color-muted)">{t("rentalBody")}</p>
            <ul className="flex flex-col gap-3">
              {rentalPoints.map((point) => (
                <li key={point} className="flex items-center gap-3 text-sm">
                  <span aria-hidden="true" className="h-px w-6 bg-(--color-primary)" />
                  {point}
                </li>
              ))}
            </ul>
            <Link href={rentalHref} className={buttonVariants({ variant: "primary", size: "lg", className: "mt-2" })}>
              {t("rentalCta")}
            </Link>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="mx-auto max-w-6xl px-6 py-24 md:py-32">
          <div className="mb-14 flex flex-col gap-3 md:mb-20">
            <Eyebrow>{t("howEyebrow")}</Eyebrow>
            <h2 className="font-display max-w-2xl text-4xl md:text-6xl">{t("howTitle")}</h2>
          </div>
          <ol className="grid gap-12 md:grid-cols-3 md:gap-10">
            {steps.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-3">
                <span aria-hidden="true" className="font-display text-6xl text-(--color-primary)/30">
                  0{i + 1}
                </span>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="max-w-xs text-(--color-muted)">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* CLOSING CALL TO ACTION */}
        <section className="bg-(--color-forest) py-24 text-white md:py-32">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-7 px-6 text-center">
            <h2 className="font-display text-4xl md:text-6xl">{t("ctaTitle")}</h2>
            <p className="max-w-lg text-white/70">{t("ctaBody")}</p>
            <Link href="/corporate#quote" className={buttonVariants({ variant: "primary", size: "lg" })}>
              {t("ctaButton")}
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
