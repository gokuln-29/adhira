import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/seo/site";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { blog_posts, categories, products } from "@/lib/db/schema";

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
  const [productRows, categoryRows, postRows] = await Promise.all([
    db.select({ slug: products.slug }).from(products).where(eq(products.status, "active")),
    db.select({ slug: categories.slug }).from(categories),
    db.select({ slug: blog_posts.slug }).from(blog_posts).where(eq(blog_posts.status, "published")),
  ]);

  const staticPages: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "", priority: 1, changeFrequency: "daily" },
    { path: "/shop", priority: 0.9, changeFrequency: "daily" },
    { path: "/setups", priority: 0.7, changeFrequency: "weekly" },
    { path: "/corporate", priority: 0.7, changeFrequency: "weekly" },
    { path: "/offers", priority: 0.6, changeFrequency: "daily" },
    { path: "/blog", priority: 0.6, changeFrequency: "weekly" },
    { path: "/about", priority: 0.5, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.5, changeFrequency: "monthly" },
    { path: "/delivery", priority: 0.4, changeFrequency: "monthly" },
    { path: "/returns", priority: 0.4, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  ];

  const entries: MetadataRoute.Sitemap = [
    ...staticPages.flatMap((p) => withLocales(p.path, p.priority, p.changeFrequency)),
    ...categoryRows.flatMap((c) => withLocales(`/shop/${c.slug}`, 0.8, "weekly")),
    ...productRows.flatMap((p) => withLocales(`/products/${p.slug}`, 0.8, "weekly")),
    ...postRows.flatMap((p) => withLocales(`/blog/${p.slug}`, 0.5, "monthly")),
  ];

  return entries;
}
