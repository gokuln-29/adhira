import { createPublicClient } from "@/lib/supabase/public";
import type { BlogPostRow } from "@/lib/data/types";

const BLOG_SELECT =
  "id, title, slug, cover, excerpt, body, category, tags, status, published_at, seo_title, seo_description";

export async function getPublishedPosts(): Promise<BlogPostRow[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select(BLOG_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as BlogPostRow[];
}

export async function getPostBySlug(slug: string): Promise<BlogPostRow | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select(BLOG_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) throw error;
  return data as unknown as BlogPostRow | null;
}
