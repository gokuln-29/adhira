import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, products } from "@/lib/db/schema";

// Names for the offer form's "applies to" pickers.
export async function getOfferPickOptions() {
  const [cats, prods] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.position)),
    db.select({ id: products.id, name: products.name }).from(products).orderBy(asc(products.name)),
  ]);
  return { categories: cats, products: prods };
}
