import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { offers } from "@/lib/db/schema";
import { dubaiNow } from "@/lib/delivery/rules";
import { couponWindowOpen } from "@/lib/offers/coupon";
import type { OfferRow } from "@/lib/data/types";

export const offerColumns = {
  id: offers.id,
  title: offers.title,
  type: offers.type,
  value: offers.value,
  code: offers.code,
  scope: offers.scope,
  min_subtotal: offers.min_subtotal,
  max_uses: offers.max_uses,
  max_uses_per_customer: offers.max_uses_per_customer,
  starts: offers.starts,
  ends: offers.ends,
  active: offers.active,
};

// Public list: only what a customer could redeem today (active, inside its date window,
// and a real discount type), so expired codes aren't advertised.
export async function getActiveOffers(): Promise<OfferRow[]> {
  const rows = await db.select(offerColumns).from(offers).where(eq(offers.active, true)).orderBy(desc(offers.starts));
  const today = dubaiNow(new Date()).date;
  return rows.filter((o) => (o.type === "percent" || o.type === "flat") && couponWindowOpen(o.starts, o.ends, today) === "open");
}
