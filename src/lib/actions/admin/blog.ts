"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/admin/auth";
import { refreshStorefront } from "@/lib/actions/admin/refresh-storefront";

export interface PostFormInput {
  title: string;
  slug: string;
  cover: string;
  excerpt: string;
  body: string;
  category: string;
  tags: string[];
  status: "draft" | "published";
  seo_title: string;
  seo_description: string;
}

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function buildRow(input: PostFormInput, existingPublishedAt?: string | null) {
  return {
    title: input.title.trim(),
    slug: input.slug.trim(),
    cover: input.cover.trim() || null,
    excerpt: input.excerpt.trim() || null,
    body: input.body,
    category: input.category.trim() || null,
    tags: input.tags,
    status: input.status,
    published_at:
      input.status === "published" ? existingPublishedAt ?? new Date().toISOString() : null,
    seo_title: input.seo_title.trim() || null,
    seo_description: input.seo_description.trim() || null,
  };
}

export async function createPost(input: PostFormInput): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .insert(buildRow(input))
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/blog");
  refreshStorefront();
  return { ok: true, id: data.id };
}

export async function updatePost(id: string, input: PostFormInput): Promise<ActionResult> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("blog_posts")
    .select("published_at")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("blog_posts")
    .update(buildRow(input, existing?.published_at))
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/blog");
  refreshStorefront();
  revalidatePath(`/admin/blog/${id}`);
  return { ok: true };
}

export async function deletePost(id: string): Promise<ActionResult> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { error } = await supabase.from("blog_posts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/blog");
  refreshStorefront();
  return { ok: true };
}
