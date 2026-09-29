"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/admin/auth";
import { refreshStorefront } from "@/lib/actions/admin/refresh-storefront";
import type { ProductCardDetail } from "@/components/product/product-card";
import { productInputSchema, type ProductInput } from "@/lib/validators/product";

export interface ProductImageInput {
  url: string;
  alt: string;
  is_primary: boolean;
}

export interface ProductFormInput {
  name: string;
  name_ar: string;
  short_description_ar: string;
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
  min_order_qty: number;
  min_order_value: number;
  allows_vessel: boolean;
  vessel_price: number;
  vessel_deposit: number;
  is_rental: boolean;
  rental_monthly_price: number | null;
  rental_min_months: number;
  rental_deposit: number;
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

function toColumns(input: ProductInput) {
  return {
    name: input.name,
    name_ar: input.name_ar || null,
    short_description_ar: input.short_description_ar || null,
    slug: input.slug,
    short_description: input.short_description || null,
    details: input.details as unknown as never,
    base_price: input.base_price,
    discount_type: input.discount_type,
    discount_value: input.discount_value,
    sale_start: input.sale_start,
    sale_end: input.sale_end,
    category_id: input.category_id,
    tags: input.tags,
    status: input.status,
    min_order_qty: input.min_order_qty,
    min_order_value: input.min_order_value,
    allows_vessel: input.allows_vessel,
    vessel_price: input.vessel_price,
    vessel_deposit: input.vessel_deposit,
    is_rental: input.is_rental,
    rental_monthly_price: input.rental_monthly_price,
    rental_min_months: input.rental_min_months,
    rental_deposit: input.rental_deposit,
  };
}

function validate(raw: ProductFormInput): { ok: true; input: ProductInput } | { ok: false; error: string } {
  const parsed = productInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the product details." };
  }
  return { ok: true, input: parsed.data };
}

export async function createProduct(
  raw: ProductFormInput,
): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  const checked = validate(raw);
  if (!checked.ok) return checked;
  const input = checked.input;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .insert(toColumns(input))
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
  raw: ProductFormInput,
): Promise<ActionResult> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  const checked = validate(raw);
  if (!checked.ok) return checked;
  const input = checked.input;
  const supabase = await createClient();

  const { error } = await supabase
    .from("products")
    .update(toColumns(input))
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
