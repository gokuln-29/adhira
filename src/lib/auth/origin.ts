import "server-only";
import { headers } from "next/headers";
import { SITE_URL } from "@/lib/seo/site";

// Defence in depth on top of Next's built-in server-action Origin check and the
// SameSite cookies: state-changing requests must come from our own origin.
export async function assertSameOrigin(): Promise<boolean> {
  const h = await headers();
  const origin = h.get("origin");
  // Non-browser callers and same-origin GET-style fetches omit Origin; browsers
  // always send it on cross-site POSTs, so a missing header is not a CSRF risk
  // given SameSite cookies.
  if (!origin) return true;
  try {
    const o = new URL(origin);
    const allowed = new Set<string>([new URL(SITE_URL).host]);
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host && process.env.NODE_ENV !== "production") allowed.add(host);
    // www/apex are the same site.
    for (const a of [...allowed]) allowed.add(a.startsWith("www.") ? a.slice(4) : `www.${a}`);
    return allowed.has(o.host);
  } catch {
    return false;
  }
}
