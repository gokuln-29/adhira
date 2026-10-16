"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { dbErrorMessage, newId } from "@/lib/db/helpers";
import { clearRedirectsFor, recordSlugChange } from "@/lib/redirects";
import { authorize } from "@/lib/admin/auth";
import { refreshStorefront } from "@/lib/actions/admin/refresh-storefront";

export interface CategoryFormInput {
  name: string;
  name_ar: string;
  slug: string;
  image: string | null;
  position: number;
}

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function toColumns(input: CategoryFormInput) {
  return {
    name: input.name.trim().slice(0, 200),
    name_ar: input.name_ar.trim().slice(0, 200) || null,
    slug: input.slug.trim(),
    image: input.image?.trim() || null,
    position: input.position,
  };
}

export async function createCategory(input: CategoryFormInput): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  const id = newId();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(categories).values({ id, ...toColumns(input) });
      await recordSlugChange(tx, "category", id, null, input.slug.trim());
    });
  } catch (err) {
    return { ok: false, error: dbErrorMessage(err, "category") };
  }
  revalidatePath("/admin/categories");
  refreshStorefront();
  return { ok: true, id };
}

export async function updateCategory(id: string, input: CategoryFormInput): Promise<ActionResult> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  try {
    await db.transaction(async (tx) => {
      const [before] = await tx.select({ slug: categories.slug }).from(categories).where(eq(categories.id, id)).limit(1);
      await tx.update(categories).set(toColumns(input)).where(eq(categories.id, id));
      await recordSlugChange(tx, "category", id, before?.slug, input.slug.trim());
    });
  } catch (err) {
    return { ok: false, error: dbErrorMessage(err, "category") };
  }
  revalidatePath("/admin/categories");
  refreshStorefront();
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  try {
    await db.transaction(async (tx) => {
      await tx.delete(categories).where(eq(categories.id, id));
      await clearRedirectsFor(tx, "category", [id]);
    });
  } catch (err) {
    return { ok: false, error: dbErrorMessage(err, "category") };
  }
  revalidatePath("/admin/categories");
  refreshStorefront();
  return { ok: true };
}
