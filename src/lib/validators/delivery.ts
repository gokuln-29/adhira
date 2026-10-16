import { z } from "zod";
import { EMIRATES } from "@/lib/constants/emirates";
import { DELIVERY_SLOTS } from "@/lib/delivery/rules";

const aed = z.number().finite().min(0).max(100_000);

export const deliveryRulesSchema = z
  .object({
    zones: z
      .array(
        z.object({
          emirate: z.enum(EMIRATES),
          enabled: z.boolean(),
          fee: aed.max(1000, "A delivery fee above AED 1,000 looks like a typo."),
          free_over: aed.nullable(),
          same_day: z.boolean(),
        }),
      )
      .length(EMIRATES.length, "Every emirate needs a row."),
    sameDayCutoff: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Cut-off must be a time like 14:00."),
    sameDayMinPrepHours: z.number().int().min(0).max(12),
    maxDaysAhead: z.number().int().min(1).max(365),
    closedWeekdays: z.array(z.number().int().min(0).max(6)).max(6, "At least one weekday must stay open."),
    disabledSlots: z.array(z.enum(DELIVERY_SLOTS.map((s) => s.id) as [string, ...string[]])),
    blackouts: z
      .array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), note: z.string().trim().max(200) }))
      .max(300),
  })
  .refine((v) => new Set(v.zones.map((z) => z.emirate)).size === EMIRATES.length, "Each emirate must appear once.")
  .refine((v) => v.disabledSlots.length < DELIVERY_SLOTS.length, "At least one time slot must stay on.");

export type DeliveryRulesInput = z.input<typeof deliveryRulesSchema>;
