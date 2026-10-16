"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { authorize } from "@/lib/admin/auth";

export type LeadStage = "new" | "contacted" | "quoted" | "won" | "lost";
const STAGES: readonly LeadStage[] = ["new", "contacted", "quoted", "won", "lost"];

export async function updateLeadStage(
  id: string,
  stage: LeadStage,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await authorize("handleOrders");
  if (!auth.ok) return auth;
  if (!STAGES.includes(stage)) return { ok: false, error: "Unknown stage." };
  try {
    await db.update(leads).set({ stage }).where(eq(leads.id, id));
  } catch (err) {
    console.error("[updateLeadStage]", err);
    return { ok: false, error: "Couldn't update the lead." };
  }
  revalidatePath("/admin/crm");
  return { ok: true };
}
