"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { ops_alerts } from "@/lib/db/schema";
import { authorize } from "@/lib/admin/auth";

// Owners and managers handle payment problems. Resolving only hides the alert: if
// the same problem happens again it reopens and emails again.
export async function resolveAlert(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  await db
    .update(ops_alerts)
    .set({ resolved_at: new Date().toISOString(), resolved_by: auth.admin.id })
    .where(and(eq(ops_alerts.id, id), isNull(ops_alerts.resolved_at)));
  revalidatePath("/admin");
  return { ok: true };
}
