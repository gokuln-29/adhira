import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/seo/site";
import { createPublicClient } from "@/lib/supabase/public";

function withLocales(pathname: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]) {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = `${SITE_URL}/${locale}${pathname}`;
  }

  return routing.locales.map((locale) => ({
    url: `${SITE_URL}/${locale}${pathname}`,
    alternates: { languages },
    priority,
    changeFrequency,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createPublicClient();

  const [{ data: products }, { data: categories }, { data: posts }] = await Promise.all([
    supabase.from("products").select("slug, updated_at").eq("status", "active"),
    supabase.from("categories").select("slug"),
    supabase.from("blog_posts").select("slug, updated_at").eq("status", "published"),
  ]);

  const staticPages: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "", priority: 1, changeFrequency: "daily" },
    { path: "/shop", priority: 0.9, changeFrequency: "daily" },
    { path: "/setups", priority: 0.7, changeFrequency: "weekly" },
    { path: "/corporate", priority: 0.7, changeFrequency: "weekly" },
    { path: "/offers", priority: 0.6, changeFrequency: "daily" },
    { path: "/blog", priority: 0.6, changeFrequency: "weekly" },
  ];

  const entries: MetadataRoute.Sitemap = [
    ...staticPages.flatMap((p) => withLocales(p.path, p.priority, p.changeFrequency)),
    ...(categories ?? []).flatMap((c) => withLocales(`/shop/${c.slug}`, 0.8, "weekly")),
    ...(products ?? []).flatMap((p) => withLocales(`/products/${p.slug}`, 0.8, "weekly")),
    ...(posts ?? []).flatMap((p) => withLocales(`/blog/${p.slug}`, 0.5, "monthly")),
  ];

  return entries;
}
