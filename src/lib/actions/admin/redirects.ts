"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { slug_redirects } from "@/lib/db/schema";
import { authorize } from "@/lib/admin/auth";

// Remove a redirect (e.g. created by a typo). The old URL then 404s.
export async function deleteRedirect(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  await db.delete(slug_redirects).where(eq(slug_redirects.id, id));
  revalidatePath("/admin/redirects");
  return { ok: true };
}
