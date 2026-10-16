import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { hydrateProducts, loadProductWhere, productColumns } from "@/lib/data/product-loader";
import type { ProductRow } from "@/lib/data/types";

export async function getAllProductsAdmin(): Promise<ProductRow[]> {
  const rows = await db.select(productColumns).from(products).orderBy(desc(products.created_at));
  return hydrateProducts(rows);
}

export async function getProductByIdAdmin(id: string): Promise<ProductRow | null> {
  return loadProductWhere(eq(products.id, id));
}
