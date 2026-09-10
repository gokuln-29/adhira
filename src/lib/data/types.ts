import type { PricedProduct } from "@/lib/pricing";
import type { ProductCardDetail } from "@/components/product/product-card";

export interface CategoryRow {
  id: string;
  name: string;
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

export interface ProductRow extends PricedProduct {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  short_description: string | null;
  details: ProductCardDetail[];
  status: "draft" | "active";
  tags: string[];
  product_images: ProductImageRow[];
  categories: { name: string; slug: string } | null;
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
