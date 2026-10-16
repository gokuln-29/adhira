// Evidence script for slug redirects.  npm run verify:redirects
// (The admin save/delete actions call exactly these helpers; browser-level checks are in the launch checklist.)
import "./_env";
import assert from "node:assert/strict";

async function main() {
  if (/prod/i.test(process.env.DATABASE_URL ?? "")) throw new Error("refusing: production-looking DATABASE_URL");
  const { db, pool } = await import("../src/lib/db");
  const { products, categories, blog_posts } = await import("../src/lib/db/schema");
  const { recordSlugChange, resolveSlugRedirect, clearRedirectsFor } = await import("../src/lib/redirects");
  const { eq } = await import("drizzle-orm");
  const out: string[] = [];
  const ok = (m: string) => out.push(`PASS ${m}`);
  const tag = `vr${Date.now().toString(36)}`;
  const mkProduct = async (slug: string, status: "active" | "draft" = "active") => {
    const id = crypto.randomUUID();
    await db.insert(products).values({ id, name: `verify ${slug}`, slug, details: [], base_price: 1, status, tags: [] });
    return id;
  };
  const rename = async (kind: "product" | "category" | "post", id: string, from: string, to: string) => {
    await db.transaction(async (tx) => {
      if (kind === "product") await tx.update(products).set({ slug: to }).where(eq(products.id, id));
      if (kind === "category") await tx.update(categories).set({ slug: to }).where(eq(categories.id, id));
      if (kind === "post") await tx.update(blog_posts).set({ slug: to }).where(eq(blog_posts.id, id));
      await recordSlugChange(tx, kind, id, from, to);
    });
  };
  try {
    const a = await mkProduct(`${tag}-a`);
    assert.equal(await resolveSlugRedirect("product", `${tag}-a`), null, "a live slug with no history isn't a redirect");
    await rename("product", a, `${tag}-a`, `${tag}-b`);
    assert.equal(await resolveSlugRedirect("product", `${tag}-a`), `${tag}-b`);
    ok("renaming a product makes the old slug resolve to the new one");

    await rename("product", a, `${tag}-b`, `${tag}-c`);
    assert.equal(await resolveSlugRedirect("product", `${tag}-a`), `${tag}-c`);
    assert.equal(await resolveSlugRedirect("product", `${tag}-b`), `${tag}-c`);
    ok("A -> B -> C: both old slugs land on the latest (no redirect chains)");

    await rename("product", a, `${tag}-c`, `${tag}-a`);
    assert.equal(await resolveSlugRedirect("product", `${tag}-a`), null, "the slug in use is never a redirect (no loop)");
    assert.equal(await resolveSlugRedirect("product", `${tag}-b`), `${tag}-a`);
    assert.equal(await resolveSlugRedirect("product", `${tag}-c`), `${tag}-a`);
    ok("renaming back removes the self-redirect; the others follow the product back");

    const other = await mkProduct(`${tag}-x`);
    await rename("product", other, `${tag}-x`, `${tag}-b`); // takes over a slug that used to redirect
    assert.equal(await resolveSlugRedirect("product", `${tag}-b`), null);
    ok("a slug taken over by another product stops redirecting (the live item wins)");

    await rename("product", a, `${tag}-a`, `${tag}-d`);
    await db.update(products).set({ status: "draft" }).where(eq(products.id, a));
    assert.equal(await resolveSlugRedirect("product", `${tag}-a`), null);
    await db.update(products).set({ status: "active" }).where(eq(products.id, a));
    assert.equal(await resolveSlugRedirect("product", `${tag}-a`), `${tag}-d`);
    ok("a draft target isn't redirected to (it would 404); publishing it brings the redirect back");

    // kinds don't mix
    assert.equal(await resolveSlugRedirect("category", `${tag}-a`), null);
    assert.equal(await resolveSlugRedirect("post", `${tag}-a`), null);
    ok("a product's old slug doesn't redirect category or blog URLs");

    // categories + posts use the same mechanism
    const cat = crypto.randomUUID();
    await db.insert(categories).values({ id: cat, name: `verify ${tag}`, slug: `${tag}-cat1` });
    await rename("category", cat, `${tag}-cat1`, `${tag}-cat2`);
    assert.equal(await resolveSlugRedirect("category", `${tag}-cat1`), `${tag}-cat2`);
    const post = crypto.randomUUID();
    await db.insert(blog_posts).values({ id: post, title: `verify ${tag}`, slug: `${tag}-p1`, tags: [], status: "published" });
    await rename("post", post, `${tag}-p1`, `${tag}-p2`);
    assert.equal(await resolveSlugRedirect("post", `${tag}-p1`), `${tag}-p2`);
    await db.update(blog_posts).set({ status: "draft" }).where(eq(blog_posts.id, post));
    assert.equal(await resolveSlugRedirect("post", `${tag}-p1`), null);
    ok("categories and blog posts redirect the same way (unpublished posts don't)");

    await db.transaction(async (tx) => clearRedirectsFor(tx, "product", [a]));
    assert.equal(await resolveSlugRedirect("product", `${tag}-a`), null);
    ok("deleting an item clears its redirects");

    assert.equal(await resolveSlugRedirect("product", ""), null);
    assert.equal(await resolveSlugRedirect("product", "x".repeat(500)), null);
    assert.equal(await resolveSlugRedirect("product", "%' OR 1=1 --"), null);
    ok("empty, oversized and hostile slugs resolve to nothing");
  } finally {
    await pool.query("DELETE FROM slug_redirects WHERE old_slug LIKE ?", [`${tag}%`]);
    await pool.query("DELETE FROM products WHERE slug LIKE ?", [`${tag}%`]);
    await pool.query("DELETE FROM categories WHERE slug LIKE ?", [`${tag}%`]);
    await pool.query("DELETE FROM blog_posts WHERE slug LIKE ?", [`${tag}%`]);
    await pool.end();
  }
  console.log(out.join("\n"));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
