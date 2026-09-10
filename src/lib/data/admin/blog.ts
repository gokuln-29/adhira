import { createClient } from "@/lib/supabase/server";
import type { BlogPostRow } from "@/lib/data/types";

const SELECT =
  "id, title, slug, cover, excerpt, body, category, tags, status, published_at, seo_title, seo_description";

export async function getAllPostsAdmin(): Promise<BlogPostRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select(SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as BlogPostRow[];
}

export async function getPostByIdAdmin(id: string): Promise<BlogPostRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("blog_posts").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as unknown as BlogPostRow | null;
}
