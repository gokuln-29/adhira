"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createPost, updatePost, deletePost, type PostFormInput } from "@/lib/actions/admin/blog";
import type { BlogPostRow } from "@/lib/data/types";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function PostForm({ post }: { post?: BlogPostRow }) {
  const router = useRouter();
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!post);
  const [cover, setCover] = useState(post?.cover ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [category, setCategory] = useState(post?.category ?? "");
  const [tagsInput, setTagsInput] = useState(post?.tags?.join(", ") ?? "");
  const [status, setStatus] = useState<"draft" | "published">(post?.status ?? "draft");
  const [seoTitle, setSeoTitle] = useState(post?.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(post?.seo_description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(nextStatus: "draft" | "published") {
    setSaving(true);
    setError(null);

    const input: PostFormInput = {
      title,
      slug: slug || slugify(title),
      cover,
      excerpt,
      body,
      category,
      tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
      status: nextStatus,
      seo_title: seoTitle,
      seo_description: seoDescription,
    };

    const result = post ? await updatePost(post.id, input) : await createPost(input);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/admin/blog");
    router.refresh();
  }

  async function handleDelete() {
    if (!post || !confirm(`Delete "${post.title}"?`)) return;
    setSaving(true);
    const result = await deletePost(post.id);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/admin/blog");
    router.refresh();
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4 pb-20">
      <Input
        label="Title"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
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
        hint="This is the web address. If you change it, the old link keeps working (it redirects to the new one)."
      />
      <Input label="Cover image URL" value={cover} onChange={(e) => setCover(e.target.value)} />
      <Textarea label="Excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} />
      <Textarea label="Body" value={body} onChange={(e) => setBody(e.target.value)} rows={10} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
        <Input label="Tags (comma-separated)" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
      </div>
      <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as "draft" | "published")}>
        <option value="draft">Draft</option>
        <option value="published">Published</option>
      </Select>
      <Input label="SEO title" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
      <Textarea
        label="SEO description"
        value={seoDescription}
        onChange={(e) => setSeoDescription(e.target.value)}
        rows={2}
      />

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 border-t border-(--color-hairline) bg-(--color-surface) px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          {post ? (
            <button type="button" onClick={handleDelete} className="font-mono-label text-[11px] text-red-600">
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <Button type="button" variant="secondary" disabled={saving} onClick={() => handleSave("draft")}>
              Save draft
            </Button>
            <Button type="button" disabled={saving} onClick={() => handleSave("published")}>
              {saving ? "Saving..." : "Publish"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
