import type { Metadata } from "next";
import { asc, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { delivery_blackouts } from "@/lib/db/schema";
import { DeliveryForm } from "@/components/admin/delivery/delivery-form";
import { getDeliveryRulesFresh } from "@/lib/data/delivery";
import { dubaiNow } from "@/lib/delivery/rules";

export const metadata: Metadata = { title: "Delivery" };

export default async function AdminDeliveryPage() {
  const [rules, blackouts] = await Promise.all([
    getDeliveryRulesFresh(),
    db
      .select()
      .from(delivery_blackouts)
      .where(gte(delivery_blackouts.date, dubaiNow(new Date()).date))
      .orderBy(asc(delivery_blackouts.date)),
  ]);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Delivery</h1>
      <p className="text-sm text-(--color-muted)">
        Fees, same-day cut-off, time windows and closed days. Customers see these at checkout and the server enforces them
        when an order is placed. Fees are entered before VAT (5% VAT is added and shown on the invoice).
      </p>
      <DeliveryForm
        initial={{
          zones: rules.zones,
          sameDayCutoff: rules.sameDayCutoff,
          sameDayMinPrepHours: rules.sameDayMinPrepHours,
          maxDaysAhead: rules.maxDaysAhead,
          closedWeekdays: rules.closedWeekdays,
          disabledSlots: rules.disabledSlots,
          blackouts: blackouts.map((b) => ({ date: b.date, note: b.note ?? "" })),
        }}
      />
    </div>
  );
}
