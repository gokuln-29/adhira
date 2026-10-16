import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import type { CategoryRow } from "@/lib/data/types";

const columns = {
  id: categories.id,
  name: categories.name,
  name_ar: categories.name_ar,
  slug: categories.slug,
  image: categories.image,
  position: categories.position,
};

export async function getAllCategoriesAdmin(): Promise<CategoryRow[]> {
  return db.select(columns).from(categories).orderBy(asc(categories.position));
}

export async function getCategoryByIdAdmin(id: string): Promise<CategoryRow | null> {
  const rows = await db.select(columns).from(categories).where(eq(categories.id, id)).limit(1);
  return rows[0] ?? null;
}
