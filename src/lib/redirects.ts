import "server-only";
import { and, eq } from "drizzle-orm";
import { db, type Tx } from "@/lib/db";
import { blog_posts, categories, products, slug_redirects } from "@/lib/db/schema";
import { newId } from "@/lib/db/helpers";

export type RedirectKind = "product" | "category" | "post";

/**
 * Call inside the transaction that saves an item. If its slug changed, the old slug starts
 * redirecting to it, and the NEW slug stops being a redirect (the live item always wins).
 */
export async function recordSlugChange(tx: Tx, kind: RedirectKind, id: string, oldSlug: string | null | undefined, newSlug: string): Promise<void> {
  // Whatever slug the item now uses can't also be somebody's redirect.
  await tx.delete(slug_redirects).where(and(eq(slug_redirects.kind, kind), eq(slug_redirects.old_slug, newSlug)));
  if (!oldSlug || oldSlug === newSlug) return;
  await tx
    .insert(slug_redirects)
    .values({ id: newId(), kind, old_slug: oldSlug, target_id: id })
    .onDuplicateKeyUpdate({ set: { target_id: id } });
}

/** An item is gone: drop the redirects that pointed at it (they'd lead to a 404 anyway). */
export async function clearRedirectsFor(tx: Pick<Tx, "delete">, kind: RedirectKind, ids: string[]): Promise<void> {
  for (const id of ids) await tx.delete(slug_redirects).where(and(eq(slug_redirects.kind, kind), eq(slug_redirects.target_id, id)));
}

/**
 * Where should a missing slug go? Returns the target's CURRENT slug, or null when there is
 * no redirect or the target isn't live (a draft/unpublished item would just 404 again).
 */
export async function resolveSlugRedirect(kind: RedirectKind, slug: string): Promise<string | null> {
  if (!slug || slug.length > 200) return null;
  const hit = (await db.select().from(slug_redirects).where(and(eq(slug_redirects.kind, kind), eq(slug_redirects.old_slug, slug))).limit(1))[0];
  if (!hit) return null;
  const current =
    kind === "product"
      ? await db.select({ slug: products.slug }).from(products).where(and(eq(products.id, hit.target_id), eq(products.status, "active"))).limit(1)
      : kind === "category"
        ? await db.select({ slug: categories.slug }).from(categories).where(eq(categories.id, hit.target_id)).limit(1)
        : await db.select({ slug: blog_posts.slug }).from(blog_posts).where(and(eq(blog_posts.id, hit.target_id), eq(blog_posts.status, "published"))).limit(1);
  const target = current[0]?.slug;
  return target && target !== slug ? target : null;
}
