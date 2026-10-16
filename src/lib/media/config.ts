// Shared (client-safe) media constants. The server enforces every one of these
// again; the browser copies only drive friendly early errors.
export const ALLOWED_UPLOAD_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB original
export const MAX_PIXELS = 40_000_000; // decode bomb guard (~6300 x 6300)
export const MAX_DIMENSION = 8000; // px, either side
export const MIN_DIMENSION = 200;
export const PUBLISHED_MAX_WIDTH = 2000;
export const DERIVATIVE_WIDTHS = [480, 960, 1600] as const;

export type UploadPurpose = "product" | "category" | "hero" | "blog";
export const PURPOSE_PREFIX: Record<UploadPurpose, string> = {
  product: "products",
  category: "categories",
  hero: "site",
  blog: "blog",
};
