"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type LeadStage = "new" | "contacted" | "quoted" | "won" | "lost";

export async function updateLeadStage(
  id: string,
  stage: LeadStage,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("leads").update({ stage }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/crm");
  return { ok: true };
}
