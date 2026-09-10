// Server-only usage throughout (metadata, sitemap, robots, JSON-LD) — safe to
// read Vercel's own deployment-URL env vars here as a fallback chain:
// explicit config > Vercel's stable production domain > this deployment's
// preview URL > localhost. `||` (not `??`) is deliberate: an env var present
// but set to an empty string must also fall through, not produce `new URL("")`.
const resolvedSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL &&
    `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
  "http://localhost:3000";

export const SITE_URL = resolvedSiteUrl;
export const SITE_NAME = "Flowers & Gifts";
