import { createPublicClient } from "@/lib/supabase/public";
import type { OfferRow } from "@/lib/data/types";

export async function getActiveOffers(): Promise<OfferRow[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("offers")
    .select("id, title, type, value, code, scope, starts, ends, active")
    .eq("active", true)
    .order("starts", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as OfferRow[];
}
