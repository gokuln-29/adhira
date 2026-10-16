import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { offers } from "@/lib/db/schema";
import { offerColumns } from "@/lib/data/offers";
import type { OfferRow } from "@/lib/data/types";

export async function getAllOffersAdmin(): Promise<OfferRow[]> {
  return db.select(offerColumns).from(offers).orderBy(desc(offers.starts));
}

export async function getOfferByIdAdmin(id: string): Promise<OfferRow | null> {
  const rows = await db.select(offerColumns).from(offers).where(eq(offers.id, id)).limit(1);
  return rows[0] ?? null;
}
