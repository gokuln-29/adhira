import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, product_images, products } from "@/lib/db/schema";
import type { ProductRow } from "@/lib/data/types";

// Single source of truth for the product columns the storefront and admin read
// (stock_qty and timestamps are deliberately not exposed to the UI).
export const productColumns = {
  id: products.id,
  category_id: products.category_id,
  name: products.name,
  name_ar: products.name_ar,
  slug: products.slug,
  short_description: products.short_description,
  short_description_ar: products.short_description_ar,
  details: products.details,
  base_price: products.base_price,
  discount_type: products.discount_type,
  discount_value: products.discount_value,
  sale_start: products.sale_start,
  sale_end: products.sale_end,
  vat_rate: products.vat_rate,
  min_order_qty: products.min_order_qty,
  min_order_value: products.min_order_value,
  allows_vessel: products.allows_vessel,
  vessel_price: products.vessel_price,
  vessel_deposit: products.vessel_deposit,
  is_rental: products.is_rental,
  rental_monthly_price: products.rental_monthly_price,
  rental_min_months: products.rental_min_months,
  rental_deposit: products.rental_deposit,
  status: products.status,
  tags: products.tags,
  stock_qty: products.stock_qty,
} as const;

type BaseProduct = Omit<ProductRow, "product_images" | "categories">;

// Attach images and category to a page of base product rows with two batched
// queries (no N+1), replacing PostgREST's embedded `product_images(...)`.
export async function hydrateProducts(base: BaseProduct[]): Promise<ProductRow[]> {
  if (base.length === 0) return [];
  const ids = base.map((p) => p.id);
  const catIds = [...new Set(base.map((p) => p.category_id).filter((v): v is string => !!v))];

  const [images, cats] = await Promise.all([
    db
      .select({
        product_id: product_images.product_id,
        id: product_images.id,
        url: product_images.url,
        alt: product_images.alt,
        position: product_images.position,
        is_primary: product_images.is_primary,
      })
      .from(product_images)
      .where(inArray(product_images.product_id, ids))
      .orderBy(asc(product_images.position)),
    catIds.length
      ? db
          .select({ id: categories.id, name: categories.name, name_ar: categories.name_ar, slug: categories.slug })
          .from(categories)
          .where(inArray(categories.id, catIds))
      : Promise.resolve([]),
  ]);

  const imagesByProduct = new Map<string, ProductRow["product_images"]>();
  for (const { product_id, ...img } of images) {
    const list = imagesByProduct.get(product_id) ?? [];
    list.push(img);
    imagesByProduct.set(product_id, list);
  }
  const catById = new Map(cats.map((c) => [c.id, { name: c.name, name_ar: c.name_ar, slug: c.slug }]));

  return base.map((p) => ({
    ...p,
    product_images: imagesByProduct.get(p.id) ?? [],
    categories: p.category_id ? (catById.get(p.category_id) ?? null) : null,
  }));
}

export async function loadProductWhere(where: ReturnType<typeof eq>): Promise<ProductRow | null> {
  const rows = await db.select(productColumns).from(products).where(where).limit(1);
  const hydrated = await hydrateProducts(rows as BaseProduct[]);
  return hydrated[0] ?? null;
}
