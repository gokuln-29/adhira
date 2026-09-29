import { createPublicClient } from "@/lib/supabase/public";
import type { ProductRow, CategoryRow } from "@/lib/data/types";
import type { ProductCardData } from "@/components/product/product-card";

const PRODUCT_SELECT =
  "id, category_id, name, slug, short_description, details, base_price, discount_type, discount_value, sale_start, sale_end, vat_rate, status, tags, product_images(id, url, alt, position, is_primary), categories(name, slug)";

export type ProductSort = "newest" | "price-asc" | "price-desc" | "name-asc";

export function toProductCard(row: ProductRow): ProductCardData {
  const primary =
    row.product_images.find((img) => img.is_primary) ?? row.product_images[0];

  return {
    name: row.name,
    slug: row.slug,
    short_description: row.short_description,
    details: row.details,
    image: primary ? { url: primary.url, alt: primary.alt || row.name } : null,
    base_price: row.base_price,
    discount_type: row.discount_type,
    discount_value: row.discount_value,
    sale_start: row.sale_start,
    sale_end: row.sale_end,
    vat_rate: row.vat_rate,
  };
}

export async function getCategories(): Promise<CategoryRow[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, image, position")
    .order("position", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getCategoryBySlug(slug: string): Promise<CategoryRow | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, image, position")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getActiveProducts(opts?: {
  categorySlug?: string;
  tag?: string;
  q?: string;
  sort?: ProductSort;
  limit?: number;
}): Promise<ProductRow[]> {
  const supabase = createPublicClient();
  let query = supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("status", "active");

  if (opts?.categorySlug) {
    const category = await getCategoryBySlug(opts.categorySlug);
    query = query.eq("category_id", category?.id ?? "00000000-0000-0000-0000-000000000000");
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

  if (opts?.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as ProductRow[];
}

export async function getProductBySlug(slug: string): Promise<ProductRow | null> {
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
