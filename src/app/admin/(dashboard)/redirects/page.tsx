import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { Card } from "@/components/ui/card";
import { DeleteRedirectButton } from "@/components/admin/redirects/delete-redirect-button";
import { db } from "@/lib/db";
import { blog_posts, categories, products, slug_redirects } from "@/lib/db/schema";

export const metadata: Metadata = { title: "Redirects" };

const PATH = { product: "/products/", category: "/shop/", post: "/blog/" } as const;

export default async function AdminRedirectsPage() {
  const rows = await db.select().from(slug_redirects).orderBy(desc(slug_redirects.created_at));
  const [prods, cats, posts] = await Promise.all([
    db.select({ id: products.id, slug: products.slug, status: products.status }).from(products),
    db.select({ id: categories.id, slug: categories.slug }).from(categories),
    db.select({ id: blog_posts.id, slug: blog_posts.slug, status: blog_posts.status }).from(blog_posts),
  ]);
  const current = new Map<string, { slug: string; live: boolean }>([
    ...prods.map((p) => [`product:${p.id}`, { slug: p.slug, live: p.status === "active" }] as const),
    ...cats.map((c) => [`category:${c.id}`, { slug: c.slug, live: true }] as const),
    ...posts.map((p) => [`post:${p.id}`, { slug: p.slug, live: p.status === "published" }] as const),
  ]);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Redirects</h1>
      <p className="text-sm text-(--color-muted)">
        When you change the slug of a product, category or blog post, the old link is kept here and sends visitors (and search
        engines) to the new one automatically. Nothing to do; remove an entry only if it was created by mistake.
      </p>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-(--color-hairline) font-mono-label text-[10px] text-(--color-muted)">
              <th className="px-6 py-3 text-start">Old link</th>
              <th className="px-6 py-3 text-start">Now goes to</th>
              <th className="px-6 py-3 text-start">Since</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const target = current.get(`${r.kind}:${r.target_id}`);
              return (
                <tr key={r.id} className="border-b border-(--color-hairline) last:border-0">
                  <td className="px-6 py-3 font-mono-label text-xs">{PATH[r.kind]}{r.old_slug}</td>
                  <td className="px-6 py-3 font-mono-label text-xs">
                    {target ? `${PATH[r.kind]}${target.slug}` : "(item deleted)"}
                    {target && !target.live && <span className="ms-2 text-amber-700">not live: shows “not found”</span>}
                  </td>
                  <td className="px-6 py-3 text-(--color-muted)">{new Date(r.created_at).toLocaleDateString("en-GB", { timeZone: "Asia/Dubai" })}</td>
                  <td className="px-6 py-3 text-end">
                    <DeleteRedirectButton id={r.id} from={`${PATH[r.kind]}${r.old_slug}`} />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-(--color-muted)">
                  No redirects yet. They appear when you rename a product, category or post.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
