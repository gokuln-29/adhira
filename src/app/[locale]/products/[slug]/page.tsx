import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
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
  const product = await getProductBySlug(slug);
  if (!product) return {};

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
  const product = await getProductBySlug(slug);
  if (!product) notFound();

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
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 md:grid-cols-2">
          <ProductGallery images={images} />

          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{product.name}</h1>
              {product.short_description && (
                <p className="mt-2 text-(--color-muted)">{product.short_description}</p>
              )}
            </div>

            <div className="flex items-baseline gap-3">
              <MonoLabel as="span" muted={false} className="text-lg">
                {isRental ? formatAED(product.rental_monthly_price ?? 0) : formatAED(price.finalPrice)}
                {isRental && <span className="text-(--color-muted)"> {pdp("perMonth")}</span>}
              </MonoLabel>
              {!isRental && price.isOnSale && price.originalPrice && (
                <MonoLabel className="line-through">
                  {formatAED(price.originalPrice)}
                </MonoLabel>
              )}
              {!isRental && price.discountLabel && (
                <span className="rounded-[2px] bg-(--color-primary) px-2 py-1 font-mono-label text-[10px] text-white">
                  {price.discountLabel}
                </span>
              )}
            </div>
            <MonoLabel className="-mt-4 text-[11px]">{vatNote(price.vatRate)}</MonoLabel>

            {product.details.length > 0 && (
              <dl className="grid grid-cols-2 gap-3 border-y border-(--color-hairline) py-4">
                {product.details.map((d) => (
                  <div key={d.label}>
                    <dt className="font-mono-label text-[10px] text-(--color-muted)">
                      {d.label}
                    </dt>
                    <dd className="text-sm">{d.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            <AddToCartForm
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
          </div>
        </div>

        {related.length > 0 && (
          <section className="mx-auto max-w-6xl px-6 pb-24">
            <h2 className="mb-8 text-2xl font-semibold">{pdp("relatedTitle")}</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={toProductCard(p)} addToCartLabel={pdp("addToCart")}
                perMonthLabel={pdp("perMonth")}
                minOrderLabel={pdp("minOrderShort", { qty: "{qty}" })} />
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
