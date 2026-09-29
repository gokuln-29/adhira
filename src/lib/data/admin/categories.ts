import { createClient } from "@/lib/supabase/server";
import type { CategoryRow } from "@/lib/data/types";

export async function getAllCategoriesAdmin(): Promise<CategoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, name_ar, slug, image, position")
    .order("position", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getCategoryByIdAdmin(id: string): Promise<CategoryRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, name_ar, slug, image, position")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
