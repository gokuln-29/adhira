import { createClient } from "@/lib/supabase/server";
import type { ProductRow } from "@/lib/data/types";

import { PRODUCT_SELECT } from "@/lib/data/product-select";

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
