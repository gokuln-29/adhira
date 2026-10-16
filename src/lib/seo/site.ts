// Production: https://adhiraflowers.ae. `||` (not `??`) is deliberate: an env
// var present but set to an empty string must also fall through, not produce
// `new URL("")`.
const resolvedSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const SITE_URL = resolvedSiteUrl;
export const SITE_NAME = "Adhira Flowers";
