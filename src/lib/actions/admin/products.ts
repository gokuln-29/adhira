"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db, type Tx } from "@/lib/db";
import { media_uploads, product_images, products } from "@/lib/db/schema";
import { keyFromPublicUrl } from "@/lib/media/r2";
import { deleteImageKeys } from "@/lib/media/store";
import { dbErrorMessage, newId } from "@/lib/db/helpers";
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

// Replaces every image row for the product (simple and correct at this volume).
// Returns the R2 keys that are no longer referenced so the caller can delete
// them once the transaction has committed.
async function replaceImages(tx: Tx, productId: string, images: ProductImageInput[]): Promise<string[]> {
  const before = await tx.select().from(product_images).where(eq(product_images.product_id, productId));
  const beforeByKey = new Map(before.filter((b) => b.object_key).map((b) => [b.object_key!, b]));
  await tx.delete(product_images).where(eq(product_images.product_id, productId));

  const keep = new Set<string>();
  if (images.length > 0) {
    const rows = [];
    for (const [i, img] of images.entries()) {
      const key = keyFromPublicUrl(img.url);
      if (key) keep.add(key);
      // Metadata comes from the upload record (new images) or the row being
      // replaced (images kept from before, incl. ones migrated from Supabase).
      const meta = key
        ? ((await tx.select().from(media_uploads).where(eq(media_uploads.final_key, key)).limit(1))[0] ?? beforeByKey.get(key))
        : undefined;
      rows.push({
        id: newId(),
        product_id: productId,
        url: img.url,
        object_key: key,
        alt: img.alt,
        position: i,
        is_primary: img.is_primary,
        width: meta?.width ?? null,
        height: meta?.height ?? null,
        bytes: meta?.bytes ?? null,
        checksum: meta?.checksum ?? null,
        mime_type: meta ? "image/webp" : null,
      });
    }
    await tx.insert(product_images).values(rows);
  }
  return before.map((b) => b.object_key).filter((k): k is string => !!k && !keep.has(k));
}

function toColumns(input: ProductInput) {
  return {
    name: input.name,
    name_ar: input.name_ar || null,
    short_description_ar: input.short_description_ar || null,
    slug: input.slug,
    short_description: input.short_description || null,
    details: input.details,
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

export async function createProduct(raw: ProductFormInput): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  const checked = validate(raw);
  if (!checked.ok) return checked;
  const input = checked.input;
  const id = newId();

  try {
    await db.transaction(async (tx) => {
      await tx.insert(products).values({ id, ...toColumns(input) });
      await replaceImages(tx, id, input.images);
    });
  } catch (err) {
    return { ok: false, error: dbErrorMessage(err, "product") };
  }

  revalidatePath("/admin/products");
  refreshStorefront();
  return { ok: true, id };
}

export async function updateProduct(id: string, raw: ProductFormInput): Promise<ActionResult> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  const checked = validate(raw);
  if (!checked.ok) return checked;
  const input = checked.input;

  let orphaned: string[] = [];
  try {
    orphaned = await db.transaction(async (tx) => {
      await tx.update(products).set(toColumns(input)).where(eq(products.id, id));
      return replaceImages(tx, id, input.images);
    });
  } catch (err) {
    return { ok: false, error: dbErrorMessage(err, "product") };
  }
  await deleteImageKeys(orphaned);

  revalidatePath("/admin/products");
  refreshStorefront();
  revalidatePath(`/admin/products/${id}`);
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  try {
    const imgs = await db.select({ k: product_images.object_key }).from(product_images).where(eq(product_images.product_id, id));
    await db.delete(products).where(eq(products.id, id));
    await deleteImageKeys(imgs.map((i) => i.k).filter((k): k is string => !!k));
  } catch (err) {
    return { ok: false, error: dbErrorMessage(err, "product") };
  }
  revalidatePath("/admin/products");
  refreshStorefront();
  return { ok: true };
}

const MAX_BULK = 200;

export async function bulkUpdateProductStatus(ids: string[], status: "draft" | "active"): Promise<ActionResult> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  if (ids.length === 0 || ids.length > MAX_BULK) return { ok: false, error: "Select between 1 and 200 products." };
  if (status !== "draft" && status !== "active") return { ok: false, error: "Unknown status." };
  try {
    await db.update(products).set({ status }).where(inArray(products.id, ids));
  } catch (err) {
    return { ok: false, error: dbErrorMessage(err, "product") };
  }
  revalidatePath("/admin/products");
  refreshStorefront();
  return { ok: true };
}

export async function bulkDeleteProducts(ids: string[]): Promise<ActionResult> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  if (ids.length === 0 || ids.length > MAX_BULK) return { ok: false, error: "Select between 1 and 200 products." };
  try {
    await db.delete(products).where(inArray(products.id, ids));
  } catch (err) {
    return { ok: false, error: dbErrorMessage(err, "product") };
  }
  revalidatePath("/admin/products");
  refreshStorefront();
  return { ok: true };
}
