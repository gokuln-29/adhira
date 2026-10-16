import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { blog_posts } from "@/lib/db/schema";
import { blogColumns } from "@/lib/data/blog";
import type { BlogPostRow } from "@/lib/data/types";

export async function getAllPostsAdmin(): Promise<BlogPostRow[]> {
  return db.select(blogColumns).from(blog_posts).orderBy(desc(blog_posts.created_at));
}

export async function getPostByIdAdmin(id: string): Promise<BlogPostRow | null> {
  const rows = await db.select(blogColumns).from(blog_posts).where(eq(blog_posts.id, id)).limit(1);
  return rows[0] ?? null;
}
