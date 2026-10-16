import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { offer_redemptions, offer_targets, offers, orders } from "@/lib/db/schema";
import { offerColumns } from "@/lib/data/offers";
import type { OfferRow } from "@/lib/data/types";

export interface AdminOfferRow extends OfferRow {
  /** Orders that used the code and weren't cancelled. */
  uses: number;
}

export async function getAllOffersAdmin(): Promise<AdminOfferRow[]> {
  const rows = await db.select(offerColumns).from(offers).orderBy(desc(offers.starts));
  const usage = await db
    .select({ offer_id: offer_redemptions.offer_id, n: sql<number>`COUNT(*)` })
    .from(offer_redemptions)
    .innerJoin(orders, and(eq(orders.id, offer_redemptions.order_id), ne(orders.status, "cancelled")))
    .groupBy(offer_redemptions.offer_id);
  const byOffer = new Map(usage.map((u) => [u.offer_id, Number(u.n)]));
  return rows.map((r) => ({ ...r, uses: byOffer.get(r.id) ?? 0 }));
}

export interface OfferWithTargets extends OfferRow {
  category_ids: string[];
  product_ids: string[];
}

export async function getOfferByIdAdmin(id: string): Promise<OfferWithTargets | null> {
  const rows = await db.select(offerColumns).from(offers).where(eq(offers.id, id)).limit(1);
  if (!rows[0]) return null;
  const targets = await db.select().from(offer_targets).where(eq(offer_targets.offer_id, id));
  return {
    ...rows[0],
    category_ids: targets.filter((t) => t.kind === "category").map((t) => t.target_id),
    product_ids: targets.filter((t) => t.kind === "product").map((t) => t.target_id),
  };
}
