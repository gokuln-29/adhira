import type { Metadata } from "next";
import { notFoundOrRedirect } from "@/lib/redirects-page";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localizeProduct } from "@/lib/data/localize";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { MonoLabel } from "@/components/ui/mono-label";
import { ProductGallery } from "@/components/product/product-gallery";
import { AddToCartForm } from "@/components/product/add-to-cart-form";
import { DeliveryEstimator } from "@/components/product/delivery-estimator";
import { ProductCard } from "@/components/product/product-card";
import { getActiveProducts, getProductBySlug, toProductCard, getActiveProductSlugs } from "@/lib/data/products";
import { formatAED, getEffectivePrice, vatNote } from "@/lib/pricing";
import { routing } from "@/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";
import { getStoreSettings } from "@/lib/data/settings";
import { productJsonLd } from "@/lib/seo/product";
import { JsonLd } from "@/components/seo/json-ld";

export const revalidate = 300;

export async function generateStaticParams() {
  const slugs = await getActiveProductSlugs();
  return routing.locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug: slug })));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/products/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const rawProduct = await getProductBySlug(slug);
  if (!rawProduct) return {};
  const product = localizeProduct(rawProduct, locale);

  const description =
    product.short_description ??
    `${product.name} — corporate flower and plant delivery across the UAE.`;
  const primaryImage =
    product.product_images.find((img) => img.is_primary) ?? product.product_images[0];

  return {
    title: product.name,
    description,
    alternates: buildAlternates(locale, `/products/${slug}`),
    openGraph: {
      title: product.name,
      description,
      images: primaryImage ? [primaryImage.url] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: PageProps<"/[locale]/products/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const raw = await getProductBySlug(slug);
  if (!raw) return notFoundOrRedirect("product", slug, (s) => `/${locale}/products/${s}`);
  const product = localizeProduct(raw, locale);
  const settings = await getStoreSettings();

  const price = getEffectivePrice(product);
  const isRental = product.is_rental && (product.rental_monthly_price ?? 0) > 0;
  const images = product.product_images
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((img) => ({ url: img.url, alt: img.alt || product.name }));

  const related = product.category_id
    ? (
        await getActiveProducts({
          categorySlug: product.categories?.slug,
          limit: 5,
        })
      ).filter((p) => p.id !== product.id).slice(0, 4)
    : [];

  const [b, pdp] = await Promise.all([
    getTranslations("Breadcrumbs"),
    getTranslations("Pdp"),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={productJsonLd({
          locale,
          slug: product.slug,
          name: product.name,
          description: product.short_description,
          images,
          price,
          saleEnd: product.sale_end,
          categoryName: product.categories?.name,
          soldOut: product.stock_qty != null && product.stock_qty <= 0,
        })}
      />
      <Header />
      <Breadcrumbs
        items={[
          { label: b("home"), href: "/" },
          { label: b("shop"), href: "/shop" },
          ...(product.categories
            ? [{ label: product.categories.name, href: `/shop/${product.categories.slug}` }]
            : []),
          { label: product.name },
        ]}
      />

      <main className="flex-1">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 pt-10 pb-24 lg:grid-cols-[1.1fr_1fr] lg:gap-20 lg:pt-14">
          <div className="lg:sticky lg:top-32 lg:h-fit">
            <ProductGallery images={images} />
          </div>

          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4">
              {product.categories && (
                <Link
                  href={`/shop/${product.categories.slug}`}
                  className="font-mono-label text-[11px] tracking-[0.18em] text-(--color-primary) hover:underline"
                >
                  {product.categories.name}
                </Link>
              )}
              <h1 className="font-display text-5xl md:text-6xl">{product.name}</h1>
              <span className="gold-rule" />
              {product.short_description && (
                <p className="text-lg leading-relaxed text-(--color-muted)">{product.short_description}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-mono-label text-2xl tracking-normal text-(--color-ink)">
                  {isRental ? formatAED(product.rental_monthly_price ?? 0) : formatAED(price.finalPrice)}
                  {isRental && <span className="text-base text-(--color-muted)"> {pdp("perMonth")}</span>}
                </span>
                {!isRental && price.isOnSale && price.originalPrice && (
                  <MonoLabel className="text-base line-through">{formatAED(price.originalPrice)}</MonoLabel>
                )}
                {!isRental && price.discountLabel && (
                  <span className="bg-(--color-ink) px-2.5 py-1 font-mono-label text-[10px] tracking-[0.12em] text-white">
                    {price.discountLabel}
                  </span>
                )}
              </div>
              <MonoLabel className="text-[11px] tracking-[0.12em]"><bdi>{vatNote(price.vatRate)}</bdi></MonoLabel>
            </div>

            {product.details.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-(--color-hairline) py-6">
                {product.details.map((d) => (
                  <div key={d.label}>
                    <dt className="font-mono-label text-[10px] tracking-[0.16em] text-(--color-muted)">{d.label}</dt>
                    <dd className="mt-1 text-[15px]">{d.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            <AddToCartForm
              stockLeft={product.stock_qty}
              lowStockLevel={settings.low_stock_threshold}
              product={{
                productId: product.id,
                slug: product.slug,
                name: product.name,
                image: images[0]?.url ?? null,
                base_price: product.base_price,
                discount_type: product.discount_type,
                discount_value: product.discount_value,
                sale_start: product.sale_start,
                sale_end: product.sale_end,
                vat_rate: product.vat_rate,
                min_order_qty: product.min_order_qty,
                min_order_value: product.min_order_value,
                allows_vessel: product.allows_vessel,
                vessel_price: product.vessel_price,
                vessel_deposit: product.vessel_deposit,
                is_rental: product.is_rental,
                rental_monthly_price: product.rental_monthly_price,
                rental_min_months: product.rental_min_months,
                rental_deposit: product.rental_deposit,
              }}
            />

            <DeliveryEstimator />

            <div className="divide-y divide-(--color-hairline) border-y border-(--color-hairline)">
              {[
                { title: pdp("infoDelivery"), body: pdp("infoDeliveryBody"), href: "/delivery" as const },
                { title: pdp("infoReturns"), body: pdp("infoReturnsBody"), href: "/returns" as const },
              ].map((item) => (
                <details key={item.href} className="group py-1">
                  <summary className="flex cursor-pointer list-none items-center justify-between py-4 font-mono-label text-[11px] tracking-[0.16em] [&::-webkit-details-marker]:hidden">
                    {item.title}
                    <span aria-hidden="true" className="text-lg transition-transform duration-300 group-open:rotate-45">+</span>
                  </summary>
                  <p className="pb-4 text-sm leading-relaxed text-(--color-muted)">
                    {item.body}{" "}
                    <Link href={item.href} className="text-(--color-primary) underline underline-offset-4">
                      {pdp("readMore")}
                    </Link>
                  </p>
                </details>
              ))}
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section className="border-t border-(--color-hairline) bg-(--color-surface) py-20 md:py-28">
            <div className="mx-auto max-w-7xl px-6">
            <h2 className="mb-12 font-display text-4xl md:text-5xl">{pdp("relatedTitle")}</h2>
            <div className="grid grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-4 md:gap-x-7">
              {related.map((p) => (
                <ProductCard key={p.id} product={toProductCard(p, locale)} addToCartLabel={pdp("addToCart")}
                soldOutLabel={pdp("soldOut")}
                perMonthLabel={pdp("perMonth")}
                minOrderLabel={pdp("minOrderShort", { qty: "{qty}" })} />
              ))}
            </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
