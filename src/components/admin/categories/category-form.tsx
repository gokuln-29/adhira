"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { uploadImage } from "@/lib/media/upload-client";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  type CategoryFormInput,
} from "@/lib/actions/admin/categories";
import type { CategoryRow } from "@/lib/data/types";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function CategoryForm({
  category,
  nextPosition,
}: {
  category?: CategoryRow;
  nextPosition: number;
}) {
  const router = useRouter();
  const [name, setName] = useState(category?.name ?? "");
  const [nameAr, setNameAr] = useState(category?.name_ar ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!category);
  const [image, setImage] = useState(category?.image ?? "");
  const [position, setPosition] = useState(String(category?.position ?? nextPosition));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const img = await uploadImage(file, "category");
      setImage(img.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    }
    setUploading(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const input: CategoryFormInput = {
      name,
      name_ar: nameAr,
      slug: slug || slugify(name),
      image: image || null,
      position: Number(position) || 0,
    };

    const result = category
      ? await updateCategory(category.id, input)
      : await createCategory(input);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/admin/categories");
    router.refresh();
  }

  async function handleDelete() {
    if (!category || !confirm(`Delete "${category.name}"? Products in it become uncategorized.`))
      return;
    setSaving(true);
    const result = await deleteCategory(category.id);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/admin/categories");
    router.refresh();
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="font-mono-label text-[11px] text-(--color-muted)">Image</span>
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-[2px] border border-(--color-hairline) bg-(--color-hairline)/40">
            {image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <label className="cursor-pointer border border-(--color-hairline) px-4 py-2 font-mono-label text-xs hover:border-(--color-primary)">
            {uploading ? "Uploading..." : "Upload image"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

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
        label="Name (Arabic, optional)"
        value={nameAr}
        onChange={(e) => setNameAr(e.target.value)}
        dir="rtl"
        hint="Shown on the Arabic site. Empty shows the English name."
      />
      <Input
        label="Slug"
        value={slug}
        onChange={(e) => {
          setSlug(e.target.value);
          setSlugTouched(true);
        }}
        required
        hint="This is the web address. If you change it, the old link keeps working (it redirects to the new one)."
      />
      <Input
        label="Position"
        type="number"
        value={position}
        onChange={(e) => setPosition(e.target.value)}
        hint="Lower numbers appear first on the home page and shop filters."
      />

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex items-center justify-between pt-2">
        {category && (
          <button
            type="button"
            onClick={handleDelete}
            className="font-mono-label text-[11px] text-red-600"
          >
            Delete
          </button>
        )}
        <Button type="button" disabled={saving} onClick={handleSave} className="ms-auto">
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
