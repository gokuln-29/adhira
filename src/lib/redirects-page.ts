import "server-only";
import { notFound, permanentRedirect } from "next/navigation";
import { resolveSlugRedirect, type RedirectKind } from "@/lib/redirects";

/**
 * For a storefront page whose slug didn't match anything: permanently redirect (308, which
 * search engines treat like a 301) to the item's current URL if it was renamed, else 404.
 */
export async function notFoundOrRedirect(kind: RedirectKind, slug: string, pathFor: (currentSlug: string) => string): Promise<never> {
  const current = await resolveSlugRedirect(kind, slug);
  if (current) permanentRedirect(pathFor(current));
  notFound();
}
