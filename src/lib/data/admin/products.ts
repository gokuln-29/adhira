import { createClient } from "@/lib/supabase/server";
import type { ProductRow } from "@/lib/data/types";

const PRODUCT_SELECT =
  "id, category_id, name, slug, short_description, details, base_price, discount_type, discount_value, sale_start, sale_end, vat_rate, status, tags, product_images(id, url, alt, position, is_primary), categories(name, slug)";

export async function getAllProductsAdmin(): Promise<ProductRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as ProductRow[];
}

export async function getProductByIdAdmin(id: string): Promise<ProductRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as ProductRow | null;
}
