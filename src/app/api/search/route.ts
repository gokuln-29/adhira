import { NextResponse, type NextRequest } from "next/server";
import { and, eq, like, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { escapeLike } from "@/lib/db/helpers";
import { hydrateProducts, productColumns } from "@/lib/data/product-loader";
import { withinRateLimit } from "@/lib/security/rate-limit";

// Typeahead for the header search box (was a direct browser -> Supabase query).
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ products: [] });
  if (!(await withinRateLimit("search", 60, 60))) {
    return NextResponse.json({ products: [] }, { status: 429 });
  }
  const pat = `%${escapeLike(q)}%`;
  const rows = await db
    .select(productColumns)
    .from(products)
    .where(and(eq(products.status, "active"), or(like(products.name, pat), like(products.short_description, pat))))
    .limit(5);
  const hydrated = await hydrateProducts(rows);
  return NextResponse.json({
    products: hydrated.map((p) => ({
      slug: p.slug,
      name: p.name,
      base_price: p.base_price,
      discount_type: p.discount_type,
      discount_value: p.discount_value,
      sale_start: p.sale_start,
      sale_end: p.sale_end,
      vat_rate: p.vat_rate,
      product_images: p.product_images.map((i) => ({ url: i.url, is_primary: i.is_primary })),
    })),
  });
}
