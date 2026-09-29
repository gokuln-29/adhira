"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/admin/auth";
import { refreshStorefront } from "@/lib/actions/admin/refresh-storefront";

export interface CategoryFormInput {
  name: string;
  slug: string;
  image: string | null;
  position: number;
}

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export async function createCategory(
  input: CategoryFormInput,
): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .insert({
      name: input.name.trim(),
      slug: input.slug.trim(),
      image: input.image?.trim() || null,
      position: input.position,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/categories");
  refreshStorefront();
  return { ok: true, id: data.id };
}

export async function updateCategory(
  id: string,
  input: CategoryFormInput,
): Promise<ActionResult> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({
      name: input.name.trim(),
      slug: input.slug.trim(),
      image: input.image?.trim() || null,
      position: input.position,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/categories");
  refreshStorefront();
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/categories");
  refreshStorefront();
  return { ok: true };
}
