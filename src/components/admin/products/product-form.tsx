"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/ui/mono-label";
import { Card } from "@/components/ui/card";
import { ProductCard, type ProductCardData } from "@/components/product/product-card";
import { uploadImage } from "@/lib/media/upload-client";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  type ProductFormInput,
  type ProductImageInput,
} from "@/lib/actions/admin/products";
import type { CategoryRow, ProductRow } from "@/lib/data/types";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function ProductForm({
  categories,
  product,
}: {
  categories: CategoryRow[];
  product?: ProductRow;
}) {
  const router = useRouter();

  const [name, setName] = useState(product?.name ?? "");
  const [nameAr, setNameAr] = useState(product?.name_ar ?? "");
  const [shortDescriptionAr, setShortDescriptionAr] = useState(product?.short_description_ar ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!product);
  const [shortDescription, setShortDescription] = useState(product?.short_description ?? "");
  const [details, setDetails] = useState<{ label: string; value: string }[]>(
    product?.details ?? [],
  );
  const [basePrice, setBasePrice] = useState(String(product?.base_price ?? ""));
  const [discountType, setDiscountType] = useState<"" | "percent" | "flat">(
    product?.discount_type ?? "",
  );
  const [discountValue, setDiscountValue] = useState(String(product?.discount_value ?? ""));
  const [saleStart, setSaleStart] = useState(product?.sale_start?.slice(0, 10) ?? "");
  const [saleEnd, setSaleEnd] = useState(product?.sale_end?.slice(0, 10) ?? "");
  const hasRules =
    !!product &&
    (product.min_order_qty > 1 || product.min_order_value > 0 || product.allows_vessel || product.is_rental);
  const [minQty, setMinQty] = useState(String(product?.min_order_qty ?? 1));
  const [stockQty, setStockQty] = useState(product?.stock_qty == null ? "" : String(product.stock_qty));
  const [minValue, setMinValue] = useState(product?.min_order_value ? String(product.min_order_value) : "");
  const [allowsVessel, setAllowsVessel] = useState(product?.allows_vessel ?? false);
  const [vesselPrice, setVesselPrice] = useState(product?.vessel_price ? String(product.vessel_price) : "");
  const [vesselDeposit, setVesselDeposit] = useState(product?.vessel_deposit ? String(product.vessel_deposit) : "");
  const [isRental, setIsRental] = useState(product?.is_rental ?? false);
  const [rentalPrice, setRentalPrice] = useState(product?.rental_monthly_price ? String(product.rental_monthly_price) : "");
  const [rentalMinMonths, setRentalMinMonths] = useState(String(product?.rental_min_months ?? 1));
  const [rentalDeposit, setRentalDeposit] = useState(product?.rental_deposit ? String(product.rental_deposit) : "");
  const [categoryId, setCategoryId] = useState(product?.category_id ?? "");
  const [tagsInput, setTagsInput] = useState(product?.tags?.join(", ") ?? "");
  const [images, setImages] = useState<ProductImageInput[]>(
    (product?.product_images ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((img) => ({ url: img.url, alt: img.alt, is_primary: img.is_primary })),
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function addDetailRow() {
    setDetails((d) => [...d, { label: "", value: "" }]);
  }
  function updateDetailRow(i: number, field: "label" | "value", value: string) {
    setDetails((d) => d.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  }
  function removeDetailRow(i: number) {
    setDetails((d) => d.filter((_, idx) => idx !== i));
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);

    const uploaded: ProductImageInput[] = [];

    for (const file of Array.from(files)) {
      try {
        const img = await uploadImage(file, "product");
        uploaded.push({ url: img.url, alt: "", is_primary: false });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed.");
      }
    }

    setImages((prev) => {
      const next = [...prev, ...uploaded];
      if (!next.some((img) => img.is_primary) && next.length > 0) next[0].is_primary = true;
      return next;
    });
    setUploading(false);
  }

  function setPrimary(index: number) {
    setImages((prev) => prev.map((img, i) => ({ ...img, is_primary: i === index })));
  }
  function removeImage(index: number) {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length > 0 && !next.some((img) => img.is_primary)) next[0].is_primary = true;
      return next;
    });
  }
  function updateImageAlt(index: number, alt: string) {
    setImages((prev) => prev.map((img, i) => (i === index ? { ...img, alt } : img)));
  }
  function reorderImages(from: number, to: number) {
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  const previewData: ProductCardData = useMemo(() => {
    const primary = images.find((i) => i.is_primary) ?? images[0];
    return {
      name: name || "Product name",
      slug: slug || "product-slug",
      short_description: shortDescription || null,
      details,
      image: primary ? { url: primary.url, alt: primary.alt || name } : null,
      base_price: Number(basePrice) || 0,
      discount_type: discountType || null,
      discount_value: discountValue ? Number(discountValue) : null,
      sale_start: saleStart ? new Date(saleStart).toISOString() : null,
      sale_end: saleEnd ? new Date(saleEnd).toISOString() : null,
      vat_rate: 5,
      is_rental: isRental,
      rental_monthly_price: isRental ? Number(rentalPrice) || 0 : null,
      min_order_qty: Number(minQty) || 1,
      allows_vessel: allowsVessel,
    };
  }, [name, slug, shortDescription, details, images, basePrice, discountType, discountValue, saleStart, saleEnd, isRental, rentalPrice, minQty, allowsVessel]);

  function buildInput(status: "draft" | "active"): ProductFormInput {
    return {
      name,
      name_ar: nameAr,
      short_description_ar: shortDescriptionAr,
      slug: slug || slugify(name),
      short_description: shortDescription,
      details: details.filter((d) => d.label.trim() && d.value.trim()),
      base_price: Number(basePrice) || 0,
      discount_type: discountType || null,
      discount_value: discountType ? Number(discountValue) || 0 : null,
      sale_start: discountType && saleStart ? new Date(saleStart).toISOString() : null,
      sale_end: discountType && saleEnd ? new Date(saleEnd).toISOString() : null,
      category_id: categoryId || null,
      tags: tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      status,
      images,
      min_order_qty: Number(minQty) || 1,
      stock_qty: stockQty.trim() === "" ? null : Math.max(0, Math.floor(Number(stockQty) || 0)),
      min_order_value: Number(minValue) || 0,
      allows_vessel: allowsVessel,
      vessel_price: Number(vesselPrice) || 0,
      vessel_deposit: Number(vesselDeposit) || 0,
      is_rental: isRental,
      rental_monthly_price: isRental ? Number(rentalPrice) || 0 : null,
      rental_min_months: Number(rentalMinMonths) || 1,
      rental_deposit: Number(rentalDeposit) || 0,
    };
  }

  async function handleSave(status: "draft" | "active") {
    setSaving(true);
    setError(null);

    const input = buildInput(status);
    const result = product
      ? await updateProduct(product.id, input)
      : await createProduct(input);

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/admin/products");
    router.refresh();
  }

  async function handleDelete() {
    if (!product) return;
    if (!confirm(`Delete "${product.name}"? This can't be undone.`)) return;
    setSaving(true);
    const result = await deleteProduct(product.id);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/admin/products");
    router.refresh();
  }

  return (
    <div className="pb-24">
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4 p-6">
            <MonoLabel muted={false}>Images</MonoLabel>
            <div className="grid grid-cols-4 gap-3">
              {images.map((img, i) => (
                <div
                  key={img.url}
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex !== null && dragIndex !== i) reorderImages(dragIndex, i);
                    setDragIndex(null);
                  }}
                  className="relative flex flex-col gap-1 border border-(--color-hairline) p-1"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="aspect-square w-full object-cover" />
                  <input
                    value={img.alt}
                    onChange={(e) => updateImageAlt(i, e.target.value)}
                    placeholder="Alt text"
                    className="w-full border border-(--color-hairline) px-1 py-0.5 text-[10px]"
                  />
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setPrimary(i)}
                      className={`font-mono-label text-[9px] ${img.is_primary ? "text-(--color-primary)" : "text-(--color-muted)"}`}
                    >
                      {img.is_primary ? "PRIMARY" : "SET PRIMARY"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="font-mono-label text-[9px] text-(--color-muted) hover:text-red-600"
                    >
                      REMOVE
                    </button>
                  </div>
                </div>
              ))}
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center border border-dashed border-(--color-hairline) font-mono-label text-[10px] text-(--color-muted) hover:border-(--color-primary)">
                {uploading ? "Uploading..." : "+ Add"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files)}
                  disabled={uploading}
                />
              </label>
            </div>
          </Card>

          <Card className="flex flex-col gap-4 p-6">
            <MonoLabel muted={false}>Details</MonoLabel>
            <Input
              label="Name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              required
            />
            <Input
              label="Slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              required
            />
            <Textarea
              label="Short description"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              rows={2}
            />
            <div className="mt-2 flex flex-col gap-4 border-t border-(--color-hairline) pt-4">
              <MonoLabel muted={false}>Arabic (optional)</MonoLabel>
              <p className="text-sm text-(--color-muted)">
                Shown on the Arabic site. If left empty, the English text is shown instead.
              </p>
              <Input label="Name (Arabic)" value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" />
              <Textarea
                label="Short description (Arabic)"
                value={shortDescriptionAr}
                onChange={(e) => setShortDescriptionAr(e.target.value)}
                rows={2}
                dir="rtl"
              />
            </div>
          </Card>

          <Card className="flex flex-col gap-3 p-6">
            <div className="flex items-center justify-between">
              <MonoLabel muted={false}>Spec lines (optional)</MonoLabel>
              <button
                type="button"
                onClick={addDetailRow}
                className="font-mono-label text-[10px] text-(--color-primary)"
              >
                + Add row
              </button>
            </div>
            {details.map((row, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={row.label}
                  onChange={(e) => updateDetailRow(i, "label", e.target.value)}
                  placeholder="Label (e.g. Size)"
                  className="w-1/3 border border-(--color-hairline) px-3 py-2 text-sm"
                />
                <input
                  value={row.value}
                  onChange={(e) => updateDetailRow(i, "value", e.target.value)}
                  placeholder="Value (e.g. Medium)"
                  className="flex-1 border border-(--color-hairline) px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeDetailRow(i)}
                  className="font-mono-label text-[10px] text-(--color-muted) hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            ))}
          </Card>

          <Card className="flex flex-col gap-4 p-6">
            <MonoLabel muted={false}>Price</MonoLabel>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Base price (AED)"
                type="number"
                step="0.01"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                required={!isRental}
              />
              <MonoLabel as="p" className="self-end pb-2.5 text-[11px]">
                Price excludes VAT. 5% VAT is added at checkout.
              </MonoLabel>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Select
                label="Discount"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as "" | "percent" | "flat")}
              >
                <option value="">None</option>
                <option value="percent">Percent</option>
                <option value="flat">Flat (AED)</option>
              </Select>
              {discountType && (
                <>
                  <Input
                    label={discountType === "percent" ? "Percent off" : "AED off"}
                    type="number"
                    step="0.01"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                  />
                </>
              )}
            </div>
            {discountType && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Sale start"
                  type="date"
                  value={saleStart}
                  onChange={(e) => setSaleStart(e.target.value)}
                />
                <Input
                  label="Sale end"
                  type="date"
                  value={saleEnd}
                  onChange={(e) => setSaleEnd(e.target.value)}
                />
              </div>
            )}
          </Card>

          {/* Most products need none of this: keep it folded unless the product already uses it. */}
          <details open={hasRules} className="group flex flex-col gap-6">
            <summary className="cursor-pointer border border-(--color-hairline) bg-(--color-surface) px-6 py-4 font-mono-label text-[11px]">
              Order rules: minimum order, glass vessel, rental
              <span className="ms-2 text-(--color-muted)">(optional)</span>
            </summary>
            <div className="mt-6 flex flex-col gap-6">
          <Card className="flex flex-col gap-4 p-6">
            <MonoLabel muted={false}>Stock</MonoLabel>
            <Input
              label="Units in stock (optional)"
              type="number"
              min="0"
              step="1"
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value)}
              hint="Leave empty if you don't track stock. When set, checkout sells at most this many and stops at 0; cancelling an order puts units back."
            />
            <MonoLabel muted={false}>Minimum order</MonoLabel>
            <p className="text-sm text-(--color-muted)">
              Customers can&apos;t check out with less than this. Leave at 1 and 0 for no minimum.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Minimum quantity"
                type="number"
                min="1"
                step="1"
                value={minQty}
                onChange={(e) => setMinQty(e.target.value)}
                hint="e.g. 10 for bulk office orders"
              />
              <Input
                label="Minimum order value (AED)"
                type="number"
                min="0"
                step="0.01"
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
                hint="Excludes VAT and deposits"
              />
            </div>
          </Card>

          <Card className="flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
              <MonoLabel muted={false}>Glass vessel</MonoLabel>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={allowsVessel}
                  onChange={(e) => setAllowsVessel(e.target.checked)}
                  className="h-4 w-4 accent-(--color-primary)"
                />
                Offer a glass vessel
              </label>
            </div>
            {allowsVessel && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Vessel price (AED, per unit)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={vesselPrice}
                  onChange={(e) => setVesselPrice(e.target.value)}
                  hint="Charged with VAT. 0 if included in the price"
                />
                <Input
                  label="Refundable deposit (AED, per unit)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={vesselDeposit}
                  onChange={(e) => setVesselDeposit(e.target.value)}
                  hint="Refunded when the vessel is returned. No VAT"
                />
              </div>
            )}
          </Card>

          <Card className="flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
              <MonoLabel muted={false}>Rental plant</MonoLabel>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isRental}
                  onChange={(e) => setIsRental(e.target.checked)}
                  className="h-4 w-4 accent-(--color-primary)"
                />
                This product is rented monthly
              </label>
            </div>
            {isRental && (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Input
                    label="Monthly price (AED)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={rentalPrice}
                    onChange={(e) => setRentalPrice(e.target.value)}
                    required
                  />
                  <Input
                    label="Minimum months"
                    type="number"
                    min="1"
                    max="60"
                    step="1"
                    value={rentalMinMonths}
                    onChange={(e) => setRentalMinMonths(e.target.value)}
                  />
                  <Input
                    label="Refundable deposit (AED)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={rentalDeposit}
                    onChange={(e) => setRentalDeposit(e.target.value)}
                    hint="Per unit, refunded on return"
                  />
                </div>
                <p className="text-sm text-(--color-muted)">
                  Rental products are charged monthly price × months. The Base price above is
                  ignored for rentals.
                </p>
              </>
            )}
          </Card>

            </div>
          </details>

          <Card className="flex flex-col gap-4 p-6">
            <MonoLabel muted={false}>Organize</MonoLabel>
            <Select
              label="Category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Input
              label="Tags (comma-separated)"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="bestseller, roses"
            />
          </Card>

          {error && (
            <p className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        <div className="lg:sticky lg:top-6 lg:h-fit">
          <MonoLabel muted={false} className="mb-3">
            Live preview
          </MonoLabel>
          <div className="max-w-[280px] border border-(--color-hairline) p-4">
            <ProductCard product={previewData} navigable={false} className="pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-(--color-hairline) bg-(--color-surface) px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            {product && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="font-mono-label text-[11px] text-red-600 hover:text-red-800"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => handleSave("draft")}
            >
              Save draft
            </Button>
            <Button type="button" disabled={saving} onClick={() => handleSave("active")}>
              {saving ? "Saving..." : "Publish"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
