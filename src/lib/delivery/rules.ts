// Delivery rules: fees, same-day cut-off, time windows, closed days.
// Pure functions with no server imports: the browser uses them for the checkout
// preview, and the server runs the very same code as the authority in `placeOrder`.
// All dates are calendar dates in Dubai ("YYYY-MM-DD"); "now" is an explicit argument
// so everything is testable.

export const DELIVERY_VAT_RATE = 5;

export const DELIVERY_SLOTS = [
  { id: "morning", label: "Morning (9am - 12pm)", startHour: 9 },
  { id: "afternoon", label: "Afternoon (12pm - 4pm)", startHour: 12 },
  { id: "evening", label: "Evening (4pm - 8pm)", startHour: 16 },
] as const;
export type SlotId = (typeof DELIVERY_SLOTS)[number]["id"];

export interface DeliveryZone {
  emirate: string;
  enabled: boolean;
  /** AED before VAT. */
  fee: number;
  /** Free when the goods subtotal (before VAT) reaches this. null = never free. */
  free_over: number | null;
  same_day: boolean;
}

export interface DeliveryRules {
  zones: DeliveryZone[];
  /** "HH:MM" Dubai time. */
  sameDayCutoff: string;
  sameDayMinPrepHours: number;
  maxDaysAhead: number;
  /** 0 = Sunday ... 6 = Saturday. */
  closedWeekdays: number[];
  disabledSlots: string[];
  /** "YYYY-MM-DD" dates with no deliveries. */
  blackouts: string[];
}

const fils = (aed: number) => Math.round(aed * 100);

export function dubaiNow(now: Date): { date: string; minutes: number } {
  const date = now.toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });
  const [h, m] = now
    .toLocaleTimeString("en-GB", { timeZone: "Asia/Dubai", hour12: false, hour: "2-digit", minute: "2-digit" })
    .split(":")
    .map(Number);
  return { date, minutes: (h % 24) * 60 + m };
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const weekdayOf = (date: string): number => new Date(`${date}T12:00:00Z`).getUTCDay();

const cutoffMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const zoneFor = (rules: DeliveryRules, emirate: string) => rules.zones.find((z) => z.emirate === emirate);

export function isDeliverableDate(rules: DeliveryRules, date: string): boolean {
  return !rules.blackouts.includes(date) && !rules.closedWeekdays.includes(weekdayOf(date));
}

/** Slots that can be picked for a date (enabled ones; for today, only those far enough away). */
export function slotsFor(rules: DeliveryRules, date: string, now: Date) {
  const enabled = DELIVERY_SLOTS.filter((s) => !rules.disabledSlots.includes(s.id));
  const today = dubaiNow(now);
  if (date !== today.date) return enabled;
  return enabled.filter((s) => s.startHour * 60 >= today.minutes + rules.sameDayMinPrepHours * 60);
}

/** Can this emirate still get a delivery today? */
export function sameDayAvailable(rules: DeliveryRules, emirate: string, now: Date): boolean {
  const zone = zoneFor(rules, emirate);
  const today = dubaiNow(now);
  return (
    !!zone?.enabled &&
    zone.same_day &&
    today.minutes < cutoffMinutes(rules.sameDayCutoff) &&
    isDeliverableDate(rules, today.date) &&
    slotsFor(rules, today.date, now).length > 0
  );
}

/** First date the customer can choose, or null if nothing is bookable. */
export function earliestDate(rules: DeliveryRules, emirate: string, now: Date): string | null {
  const today = dubaiNow(now).date;
  const start = sameDayAvailable(rules, emirate, now) ? today : addDays(today, 1);
  for (let i = 0; i <= rules.maxDaysAhead; i++) {
    const d = addDays(start, i);
    if (d > addDays(today, rules.maxDaysAhead)) return null;
    if (isDeliverableDate(rules, d) && slotsFor(rules, d, now).length > 0) return d;
  }
  return null;
}

/** Delivery fee in fils (before VAT) for a goods subtotal (before VAT) in fils. */
export function deliveryFeeFils(zone: DeliveryZone, goodsFils: number): number {
  if (zone.free_over != null && goodsFils >= fils(zone.free_over)) return 0;
  return fils(zone.fee);
}

export const deliveryVatFils = (feeFils: number) => Math.round((feeFils * DELIVERY_VAT_RATE) / 100);

export type DeliveryErrorCode =
  | "zone_disabled"
  | "date_required"
  | "date_unavailable"
  | "date_too_far"
  | "slot_invalid"
  | "slot_too_soon";

export type DeliveryCheck =
  | { ok: true; feeFils: number; vatFils: number; slotLabel: string }
  | { ok: false; code: DeliveryErrorCode; message: string };

export function validateDelivery(
  rules: DeliveryRules,
  input: { emirate: string; date: string | undefined; slot: string | undefined; goodsFils: number },
  now: Date,
): DeliveryCheck {
  const zone = zoneFor(rules, input.emirate);
  if (!zone || !zone.enabled) {
    return { ok: false, code: "zone_disabled", message: `We don't deliver to ${input.emirate} yet. Please contact us.` };
  }
  if (!input.date) return { ok: false, code: "date_required", message: "Please choose a delivery date." };

  const today = dubaiNow(now).date;
  if (input.date > addDays(today, rules.maxDaysAhead)) {
    return { ok: false, code: "date_too_far", message: `Please choose a date within the next ${rules.maxDaysAhead} days.` };
  }
  const earliest = earliestDate(rules, input.emirate, now);
  if (input.date < today || !earliest || input.date < earliest) {
    return {
      ok: false,
      code: "date_unavailable",
      message: earliest
        ? `The earliest delivery to ${input.emirate} is ${earliest}. Please choose that date or later.`
        : "We can't take delivery bookings right now. Please contact us.",
    };
  }
  if (!isDeliverableDate(rules, input.date)) {
    return { ok: false, code: "date_unavailable", message: "We don't deliver on that day. Please choose another date." };
  }

  const slot = DELIVERY_SLOTS.find((s) => s.id === input.slot);
  if (!slot || rules.disabledSlots.includes(slot.id)) {
    return { ok: false, code: "slot_invalid", message: "Please choose a delivery time slot." };
  }
  if (!slotsFor(rules, input.date, now).some((s) => s.id === slot.id)) {
    return { ok: false, code: "slot_too_soon", message: "That time slot is too soon for today. Please choose a later one." };
  }

  const feeFils = deliveryFeeFils(zone, input.goodsFils);
  return { ok: true, feeFils, vatFils: deliveryVatFils(feeFils), slotLabel: slot.label };
}

/** "14:00" -> "2:00 PM" / "2:00 م" for display. */
export function formatCutoff(hhmm: string, locale: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(2000, 0, 1, h, m)).toLocaleTimeString(locale === "ar" ? "ar-AE" : "en-US", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
  });
}
