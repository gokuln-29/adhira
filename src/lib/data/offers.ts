import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { offers } from "@/lib/db/schema";
import type { OfferRow } from "@/lib/data/types";

export const offerColumns = {
  id: offers.id,
  title: offers.title,
  type: offers.type,
  value: offers.value,
  code: offers.code,
  scope: offers.scope,
  starts: offers.starts,
  ends: offers.ends,
  active: offers.active,
};

export async function getActiveOffers(): Promise<OfferRow[]> {
  return db.select(offerColumns).from(offers).where(eq(offers.active, true)).orderBy(desc(offers.starts));
}
