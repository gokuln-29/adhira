import type { PricedProduct, ProductRules } from "@/lib/pricing";
import type { ProductCardDetail } from "@/components/product/product-card";

export interface CategoryRow {
  id: string;
  name: string;
  name_ar: string | null;
  slug: string;
  image: string | null;
  position: number;
}

export interface ProductImageRow {
  id: string;
  url: string;
  alt: string;
  position: number;
  is_primary: boolean;
}

export interface ProductRow extends PricedProduct, ProductRules {
  id: string;
  category_id: string | null;
  name: string;
  name_ar: string | null;
  slug: string;
  short_description: string | null;
  short_description_ar: string | null;
  details: ProductCardDetail[];
  status: "draft" | "active";
  tags: string[];
  // Admin-only meaning; null = stock not tracked.
  stock_qty: number | null;
  product_images: ProductImageRow[];
  categories: { name: string; name_ar: string | null; slug: string } | null;
}

export interface OfferRow {
  id: string;
  title: string;
  type: "percent" | "flat" | "code";
  value: number;
  code: string | null;
  scope: string;
  starts: string | null;
  ends: string | null;
  active: boolean;
}

export interface BlogPostRow {
  id: string;
  title: string;
  slug: string;
  cover: string | null;
  excerpt: string | null;
  body: string | null;
  category: string | null;
  tags: string[];
  status: "draft" | "published";
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
}
