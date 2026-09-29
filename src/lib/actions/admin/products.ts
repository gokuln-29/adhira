"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/admin/auth";
import { refreshStorefront } from "@/lib/actions/admin/refresh-storefront";
import type { ProductCardDetail } from "@/components/product/product-card";

export interface ProductImageInput {
  url: string;
  alt: string;
  is_primary: boolean;
}

export interface ProductFormInput {
  name: string;
  slug: string;
  short_description: string;
  details: ProductCardDetail[];
  base_price: number;
  discount_type: "percent" | "flat" | null;
  discount_value: number | null;
  sale_start: string | null;
  sale_end: string | null;
  category_id: string | null;
  tags: string[];
  status: "draft" | "active";
  images: ProductImageInput[];
}

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function replaceImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  images: ProductImageInput[],
) {
  const { error: deleteError } = await supabase
    .from("product_images")
    .delete()
    .eq("product_id", productId);
  if (deleteError) throw deleteError;

  if (images.length === 0) return;

  const { error: insertError } = await supabase.from("product_images").insert(
    images.map((img, i) => ({
      product_id: productId,
      url: img.url,
      alt: img.alt,
      position: i,
      is_primary: img.is_primary,
    })),
  );
  if (insertError) throw insertError;
}

export async function createProduct(
  input: ProductFormInput,
): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .insert({
      name: input.name.trim(),
      slug: input.slug.trim(),
      short_description: input.short_description.trim() || null,
      details: input.details as unknown as never,
      base_price: input.base_price,
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      sale_start: input.sale_start,
      sale_end: input.sale_end,
      category_id: input.category_id,
      tags: input.tags,
      status: input.status,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  try {
    await replaceImages(supabase, data.id, input.images);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save images" };
  }

  revalidatePath("/admin/products");
  refreshStorefront();
  return { ok: true, id: data.id };
}

export async function updateProduct(
  id: string,
  input: ProductFormInput,
): Promise<ActionResult> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  const supabase = await createClient();

  const { error } = await supabase
    .from("products")
    .update({
      name: input.name.trim(),
      slug: input.slug.trim(),
      short_description: input.short_description.trim() || null,
      details: input.details as unknown as never,
      base_price: input.base_price,
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      sale_start: input.sale_start,
      sale_end: input.sale_end,
      category_id: input.category_id,
      tags: input.tags,
      status: input.status,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  try {
    await replaceImages(supabase, id, input.images);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save images" };
  }

  revalidatePath("/admin/products");
  refreshStorefront();
  revalidatePath(`/admin/products/${id}`);
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/products");
  refreshStorefront();
  return { ok: true };
}

export async function bulkUpdateProductStatus(
  ids: string[],
  status: "draft" | "active",
): Promise<ActionResult> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ status }).in("id", ids);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/products");
  refreshStorefront();
  return { ok: true };
}

export async function bulkDeleteProducts(ids: string[]): Promise<ActionResult> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().in("id", ids);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/products");
  refreshStorefront();
  return { ok: true };
}
