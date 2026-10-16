import { unstable_cache } from "next/cache";
import { asc, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { delivery_blackouts, delivery_settings, delivery_zones } from "@/lib/db/schema";
import { EMIRATES } from "@/lib/constants/emirates";
import { addDays, dubaiNow, type DeliveryRules } from "@/lib/delivery/rules";

const EMPTY: DeliveryRules = {
  zones: [],
  sameDayCutoff: "14:00",
  sameDayMinPrepHours: 2,
  maxDaysAhead: 60,
  closedWeekdays: [],
  disabledSlots: [],
  blackouts: [],
};

/** Always from the database: use this for anything that decides money or dates (checkout). */
export async function getDeliveryRulesFresh(now = new Date()): Promise<DeliveryRules> {
  const today = dubaiNow(now).date;
  const [zones, settings, blackouts] = await Promise.all([
    db.select().from(delivery_zones),
    db.select().from(delivery_settings).limit(1),
    // Only dates still ahead matter; keeps the payload small.
    db.select({ date: delivery_blackouts.date }).from(delivery_blackouts).where(gte(delivery_blackouts.date, today)).orderBy(asc(delivery_blackouts.date)),
  ]);
  // Stable, human order (Dubai first) rather than whatever the database returns.
  zones.sort((a, b) => EMIRATES.indexOf(a.emirate as (typeof EMIRATES)[number]) - EMIRATES.indexOf(b.emirate as (typeof EMIRATES)[number]));
  const s = settings[0];
  if (!s) return { ...EMPTY, zones };
  return {
    zones,
    sameDayCutoff: s.same_day_cutoff,
    sameDayMinPrepHours: s.same_day_min_prep_hours,
    maxDaysAhead: s.max_days_ahead,
    closedWeekdays: s.closed_weekdays,
    disabledSlots: s.disabled_slots,
    blackouts: blackouts.map((b) => b.date).filter((d) => d <= addDays(today, s.max_days_ahead + 1)),
  };
}

// Storefront display (header banner, PDP estimator, checkout preview). Cached like
// the catalog and refreshed by `refreshStorefront()`; the server re-checks everything
// against `getDeliveryRulesFresh` when an order is placed.
export const getDeliveryRules = unstable_cache(() => getDeliveryRulesFresh(), ["delivery-rules"], {
  tags: ["catalog"],
  revalidate: 300,
});
