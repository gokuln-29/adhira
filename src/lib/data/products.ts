import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { ProductRow, CategoryRow } from "@/lib/data/types";
import type { ProductCardData } from "@/components/product/product-card";

import { localizeProduct } from "@/lib/data/localize";
import { PRODUCT_SELECT } from "@/lib/data/product-select";

// Storefront reads are cached and tagged "catalog"; admin mutations call
// `refreshStorefront()` (updateTag) so edits show up immediately instead of
// waiting for the timer. Keeps most page views off the database entirely.
const CACHE_SECONDS = 300;
export const CATALOG_TAG = "catalog";
export const PAGE_SIZE = 24;

const PRODUCT_SELECT_BY_CATEGORY = PRODUCT_SELECT.replace("categories(name, name_ar, slug)", "categories!inner(name, name_ar, slug)");

export type ProductSort = "newest" | "price-asc" | "price-desc" | "name-asc";

export function toProductCard(row: ProductRow, locale = "en"): ProductCardData {
  const p = localizeProduct(row, locale);
  const primary =
    row.product_images.find((img) => img.is_primary) ?? row.product_images[0];

  return {
    name: p.name,
    slug: row.slug,
    short_description: p.short_description,
    details: row.details,
    image: primary ? { url: primary.url, alt: primary.alt || p.name } : null,
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

export const getCategories = unstable_cache(fetchCategories, ["categories"], {
  tags: [CATALOG_TAG],
  revalidate: CACHE_SECONDS,
});

async function fetchCategories(): Promise<CategoryRow[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, name_ar, slug, image, position")
    .order("position", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export const getCategoryBySlug = unstable_cache(fetchCategoryBySlug, ["category-by-slug"], {
  tags: [CATALOG_TAG],
  revalidate: CACHE_SECONDS,
});

async function fetchCategoryBySlug(slug: string): Promise<CategoryRow | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, name_ar, slug, image, position")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data;
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
  const supabase = createPublicClient();
  // One query with an inner join instead of "look up the category, then query".
  let query = supabase
    .from("products")
    .select(opts?.categorySlug ? PRODUCT_SELECT_BY_CATEGORY : PRODUCT_SELECT)
    .eq("status", "active");

  if (opts?.categorySlug) {
    query = query.eq("categories.slug", opts.categorySlug);
  }
  if (opts?.rentalOnly) {
    query = query.eq("is_rental", true);
  }
  if (opts?.tag) {
    query = query.contains("tags", [opts.tag]);
  }
  if (opts?.q) {
    const escaped = opts.q.replace(/[%_]/g, (c) => `\\${c}`);
    query = query.or(`name.ilike.%${escaped}%,short_description.ilike.%${escaped}%`);
  }

  switch (opts?.sort) {
    case "price-asc":
      query = query.order("base_price", { ascending: true });
      break;
    case "price-desc":
      query = query.order("base_price", { ascending: false });
      break;
    case "name-asc":
      query = query.order("name", { ascending: true });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  if (opts?.limit) {
    const from = opts.offset ?? 0;
    query = query.range(from, from + opts.limit - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as ProductRow[];
}

export const getProductBySlug = unstable_cache(fetchProductBySlug, ["product-by-slug"], {
  tags: [CATALOG_TAG],
  revalidate: CACHE_SECONDS,
});

// Slugs to pre-render at build time; failures fall back to on-demand render.
export async function getActiveProductSlugs(): Promise<string[]> {
  try {
    const { data } = await createPublicClient().from("products").select("slug").eq("status", "active");
    return (data ?? []).map((p) => p.slug);
  } catch {
    return [];
  }
}

export async function getCategorySlugs(): Promise<string[]> {
  try {
    const { data } = await createPublicClient().from("categories").select("slug");
    return (data ?? []).map((c) => c.slug);
  } catch {
    return [];
  }
}

async function fetchProductBySlug(slug: string): Promise<ProductRow | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  return data as unknown as ProductRow | null;
}
