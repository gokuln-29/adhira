"use server";

import { revalidatePath } from "next/cache";
import { eq, notInArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { delivery_blackouts, delivery_settings, delivery_zones } from "@/lib/db/schema";
import { authorize } from "@/lib/admin/auth";
import { refreshStorefront } from "@/lib/actions/admin/refresh-storefront";
import { addDays, dubaiNow } from "@/lib/delivery/rules";
import { deliveryRulesSchema, type DeliveryRulesInput } from "@/lib/validators/delivery";

export async function saveDeliveryRules(raw: DeliveryRulesInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await authorize("ownerOnly");
  if (!auth.ok) return auth;
  const parsed = deliveryRulesSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the delivery settings." };
  const v = parsed.data;
  const today = dubaiNow(new Date()).date;
  if (v.blackouts.some((b) => b.date > addDays(today, 800))) return { ok: false, error: "A closed date is too far in the future." };

  try {
    await db.transaction(async (tx) => {
      for (const z of v.zones) {
        await tx
          .insert(delivery_zones)
          .values({ emirate: z.emirate, enabled: z.enabled, fee: z.fee, free_over: z.free_over, same_day: z.same_day })
          .onDuplicateKeyUpdate({ set: { enabled: z.enabled, fee: z.fee, free_over: z.free_over, same_day: z.same_day } });
      }
      await tx
        .update(delivery_settings)
        .set({
          same_day_cutoff: v.sameDayCutoff,
          same_day_min_prep_hours: v.sameDayMinPrepHours,
          max_days_ahead: v.maxDaysAhead,
          closed_weekdays: [...new Set(v.closedWeekdays)].sort(),
          disabled_slots: v.disabledSlots,
        })
        .where(eq(delivery_settings.id, 1));
      const dates = [...new Map(v.blackouts.map((b) => [b.date, b])).values()];
      if (dates.length === 0) await tx.delete(delivery_blackouts);
      else {
        await tx.delete(delivery_blackouts).where(notInArray(delivery_blackouts.date, dates.map((d) => d.date)));
        for (const d of dates) {
          await tx
            .insert(delivery_blackouts)
            .values({ date: d.date, note: d.note || null })
            .onDuplicateKeyUpdate({ set: { note: d.note || null } });
        }
      }
    });
  } catch (err) {
    console.error("[saveDeliveryRules]", err);
    return { ok: false, error: "Couldn't save the delivery settings. Please try again." };
  }
  revalidatePath("/admin/delivery");
  refreshStorefront();
  return { ok: true };
}
