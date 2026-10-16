"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { blog_posts } from "@/lib/db/schema";
import { dbErrorMessage, newId } from "@/lib/db/helpers";
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
  const id = newId();
  try {
    await db.insert(blog_posts).values({ id, ...buildRow(input) });
  } catch (err) {
    return { ok: false, error: dbErrorMessage(err, "post") };
  }
  revalidatePath("/admin/blog");
  refreshStorefront();
  return { ok: true, id };
}

export async function updatePost(id: string, input: PostFormInput): Promise<ActionResult> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  try {
    const existing = await db
      .select({ published_at: blog_posts.published_at })
      .from(blog_posts)
      .where(eq(blog_posts.id, id))
      .limit(1);
    await db.update(blog_posts).set(buildRow(input, existing[0]?.published_at)).where(eq(blog_posts.id, id));
  } catch (err) {
    return { ok: false, error: dbErrorMessage(err, "post") };
  }
  revalidatePath("/admin/blog");
  refreshStorefront();
  revalidatePath(`/admin/blog/${id}`);
  return { ok: true };
}

export async function deletePost(id: string): Promise<ActionResult> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  try {
    await db.delete(blog_posts).where(eq(blog_posts.id, id));
  } catch (err) {
    return { ok: false, error: dbErrorMessage(err, "post") };
  }
  revalidatePath("/admin/blog");
  refreshStorefront();
  return { ok: true };
}
