import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { blog_posts } from "@/lib/db/schema";
import type { BlogPostRow } from "@/lib/data/types";

export const blogColumns = {
  id: blog_posts.id,
  title: blog_posts.title,
  slug: blog_posts.slug,
  cover: blog_posts.cover,
  excerpt: blog_posts.excerpt,
  body: blog_posts.body,
  category: blog_posts.category,
  tags: blog_posts.tags,
  status: blog_posts.status,
  published_at: blog_posts.published_at,
  seo_title: blog_posts.seo_title,
  seo_description: blog_posts.seo_description,
};

export async function getPublishedPosts(): Promise<BlogPostRow[]> {
  return db
    .select(blogColumns)
    .from(blog_posts)
    .where(eq(blog_posts.status, "published"))
    .orderBy(desc(blog_posts.published_at));
}

export async function getPostBySlug(slug: string): Promise<BlogPostRow | null> {
  const rows = await db
    .select(blogColumns)
    .from(blog_posts)
    .where(and(eq(blog_posts.slug, slug), eq(blog_posts.status, "published")))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPublishedPostSlugs(): Promise<string[]> {
  try {
    const rows = await db.select({ slug: blog_posts.slug }).from(blog_posts).where(eq(blog_posts.status, "published"));
    return rows.map((p) => p.slug);
  } catch {
    return [];
  }
}
