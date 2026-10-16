import { unstable_cache } from "next/cache";
import { and, asc, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, products } from "@/lib/db/schema";
import { escapeLike } from "@/lib/db/helpers";
import { hydrateProducts, loadProductWhere, productColumns } from "@/lib/data/product-loader";
import type { ProductRow, CategoryRow } from "@/lib/data/types";
import type { ProductCardData } from "@/components/product/product-card";

import { localizeProduct } from "@/lib/data/localize";

// Storefront reads are cached and tagged "catalog"; admin mutations call
// `refreshStorefront()` (updateTag) so edits show up immediately instead of
// waiting for the timer. Keeps most page views off the database entirely.
const CACHE_SECONDS = 300;
export const CATALOG_TAG = "catalog";
export const PAGE_SIZE = 24;

export type ProductSort = "newest" | "price-asc" | "price-desc" | "name-asc";

export function toProductCard(row: ProductRow, locale = "en"): ProductCardData {
  const p = localizeProduct(row, locale);
  const primary =
    row.product_images.find((img) => img.is_primary) ?? row.product_images[0];
  // A second photo (if any) fades in when the card is hovered.
  const second = row.product_images.find((img) => img !== primary);

  return {
    name: p.name,
    slug: row.slug,
    short_description: p.short_description,
    details: row.details,
    image: primary ? { url: primary.url, alt: primary.alt || p.name } : null,
    image2: second ? { url: second.url, alt: second.alt || p.name } : null,
    base_price: row.base_price,
    discount_type: row.discount_type,
    discount_value: row.discount_value,
    sale_start: row.sale_start,
    sale_end: row.sale_end,
    vat_rate: row.vat_rate,
    is_rental: row.is_rental,
    rental_monthly_price: row.rental_monthly_price,
    rental_min_months: row.rental_min_months,
    min_order_qty: row.min_order_qty,
    allows_vessel: row.allows_vessel,
  };
}

const categoryColumns = {
  id: categories.id,
  name: categories.name,
  name_ar: categories.name_ar,
  slug: categories.slug,
  image: categories.image,
  position: categories.position,
};

export const getCategories = unstable_cache(fetchCategories, ["categories"], {
  tags: [CATALOG_TAG],
  revalidate: CACHE_SECONDS,
});

async function fetchCategories(): Promise<CategoryRow[]> {
  return db.select(categoryColumns).from(categories).orderBy(asc(categories.position));
}

export const getCategoryBySlug = unstable_cache(fetchCategoryBySlug, ["category-by-slug"], {
  tags: [CATALOG_TAG],
  revalidate: CACHE_SECONDS,
});

async function fetchCategoryBySlug(slug: string): Promise<CategoryRow | null> {
  const rows = await db.select(categoryColumns).from(categories).where(eq(categories.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export interface ProductQuery {
  categorySlug?: string;
  tag?: string;
  q?: string;
  rentalOnly?: boolean;
  sort?: ProductSort;
  limit?: number;
  offset?: number;
}

const getCachedProducts = unstable_cache(fetchActiveProducts, ["active-products"], {
  tags: [CATALOG_TAG],
  revalidate: CACHE_SECONDS,
});

// Free-text searches bypass the cache: arbitrary visitor input would otherwise
// create unbounded cache entries.
export function getActiveProducts(opts?: ProductQuery): Promise<ProductRow[]> {
  return opts?.q ? fetchActiveProducts(opts) : getCachedProducts(opts);
}

async function fetchActiveProducts(opts?: ProductQuery): Promise<ProductRow[]> {
  const conds: (SQL | undefined)[] = [eq(products.status, "active")];
  if (opts?.categorySlug) conds.push(eq(categories.slug, opts.categorySlug));
  if (opts?.rentalOnly) conds.push(eq(products.is_rental, true));
  if (opts?.tag) conds.push(sql`JSON_CONTAINS(${products.tags}, JSON_QUOTE(${opts.tag}))`);
  if (opts?.q) {
    const pat = `%${escapeLike(opts.q)}%`;
    conds.push(or(like(products.name, pat), like(products.short_description, pat)));
  }

  const order =
    opts?.sort === "price-asc"
      ? asc(products.base_price)
      : opts?.sort === "price-desc"
        ? desc(products.base_price)
        : opts?.sort === "name-asc"
          ? asc(products.name)
          : desc(products.created_at);

  let query = db
    .select(productColumns)
    .from(products)
    // Left join so uncategorised products still show; filtering on
    // categories.slug above already excludes them when a category is requested.
    .leftJoin(categories, eq(products.category_id, categories.id))
    .where(and(...conds))
    .orderBy(order, asc(products.id))
    .$dynamic();

  if (opts?.limit) query = query.limit(opts.limit).offset(opts.offset ?? 0);

  const rows = await query;
  return hydrateProducts(rows);
}

export const getProductBySlug = unstable_cache(fetchProductBySlug, ["product-by-slug"], {
  tags: [CATALOG_TAG],
  revalidate: CACHE_SECONDS,
});

// Slugs to pre-render at build time; failures fall back to on-demand render.
export async function getActiveProductSlugs(): Promise<string[]> {
  try {
    const rows = await db.select({ slug: products.slug }).from(products).where(eq(products.status, "active"));
    return rows.map((p) => p.slug);
  } catch {
    return [];
  }
}

export async function getCategorySlugs(): Promise<string[]> {
  try {
    const rows = await db.select({ slug: categories.slug }).from(categories);
    return rows.map((c) => c.slug);
  } catch {
    return [];
  }
}

async function fetchProductBySlug(slug: string): Promise<ProductRow | null> {
  return loadProductWhere(and(eq(products.slug, slug), eq(products.status, "active")) as SQL);
}
