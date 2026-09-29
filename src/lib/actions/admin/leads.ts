"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/admin/auth";

export type LeadStage = "new" | "contacted" | "quoted" | "won" | "lost";

export async function updateLeadStage(
  id: string,
  stage: LeadStage,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await authorize("handleOrders");
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { error } = await supabase.from("leads").update({ stage }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/crm");
  return { ok: true };
}
