import { createClient } from "@/lib/supabase/server";
import type { OfferRow } from "@/lib/data/types";

export async function getAllOffersAdmin(): Promise<OfferRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("offers")
    .select("id, title, type, value, code, scope, starts, ends, active")
    .order("starts", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as OfferRow[];
}

export async function getOfferByIdAdmin(id: string): Promise<OfferRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("offers")
    .select("id, title, type, value, code, scope, starts, ends, active")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as OfferRow | null;
}
