// Evidence script for delivery fees and cut-off rules.  npm run verify:delivery
//  - pure rules with fixed "now" values (cut-off boundary, prep time, closed days, blackouts)
//  - placeOrder against MySQL: fee, VAT on the fee, totals, invoice, Stripe line-item sum
import "./_env";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";

async function main() {
  if (/prod/i.test(process.env.DATABASE_URL ?? "")) throw new Error("refusing: production-looking DATABASE_URL");
  const R = await import("../src/lib/delivery/rules");
  const { db, pool } = await import("../src/lib/db");
  const { products, orders, invoices } = await import("../src/lib/db/schema");
  const { placeOrder } = await import("../src/lib/orders/place-order");
  const { markOrderPaid } = await import("../src/lib/orders/transitions");
  const { orderInputSchema } = await import("../src/lib/validators/order");
  const { buildStripeLineItems, stripeTotalFils } = await import("../src/lib/stripe/line-items");
  const { financialYear } = await import("../src/lib/invoices/number");
  const { cleanupVerifyData, counterSnapshot } = await import("./_testing");
  const out: string[] = [];
  const ok = (m: string) => out.push(`PASS ${m}`);

  const rules: import("../src/lib/delivery/rules").DeliveryRules = {
    zones: [
      { emirate: "Dubai", enabled: true, fee: 25, free_over: 500, same_day: true },
      { emirate: "Abu Dhabi", enabled: true, fee: 15.5, free_over: null, same_day: false },
      { emirate: "Sharjah", enabled: false, fee: 0, free_over: null, same_day: true },
    ],
    sameDayCutoff: "14:00",
    sameDayMinPrepHours: 2,
    maxDaysAhead: 30,
    closedWeekdays: [5], // Friday
    disabledSlots: [],
    blackouts: ["2026-11-12"], // a Thursday
  };
  // Tuesday 10 Nov 2026 in Dubai (UTC+4): build instants from Dubai wall-clock time.
  const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+04:00`);
  const TUE = "2026-11-10";

  // ---- cut-off boundary (inclusive-before)
  assert.equal(R.sameDayAvailable(rules, "Dubai", at(TUE, "13:59")), true);
  assert.equal(R.sameDayAvailable(rules, "Dubai", at(TUE, "14:00")), false);
  assert.equal(R.sameDayAvailable(rules, "Dubai", at(TUE, "00:05")), true);
  assert.equal(R.sameDayAvailable(rules, "Abu Dhabi", at(TUE, "09:00")), false, "zone without same-day");
  assert.equal(R.sameDayAvailable(rules, "Sharjah", at(TUE, "09:00")), false, "disabled zone");
  ok("same-day: open at 13:59, closed at 14:00 Dubai time; only for zones that offer it");

  // ---- prep time: evening (16:00) is the last window; at 13:59 it is 2h01m away -> allowed
  assert.deepEqual(R.slotsFor(rules, TUE, at(TUE, "13:59")).map((s) => s.id), ["evening"]);
  assert.deepEqual(R.slotsFor(rules, TUE, at(TUE, "09:30")).map((s) => s.id), ["afternoon", "evening"]); // 12:00 >= 11:30
  assert.deepEqual(R.slotsFor(rules, TUE, at(TUE, "06:00")).map((s) => s.id), ["morning", "afternoon", "evening"]);
  assert.deepEqual(R.slotsFor(rules, "2026-11-11", at(TUE, "13:59")).map((s) => s.id), ["morning", "afternoon", "evening"], "future days are never limited by prep time");
  ok("same-day windows shrink with the 2 h prep time; future days keep all windows");

  // ---- earliest date: closed days, blackouts, after cut-off
  assert.equal(R.earliestDate(rules, "Dubai", at(TUE, "10:00")), TUE);
  assert.equal(R.earliestDate(rules, "Dubai", at(TUE, "15:00")), "2026-11-11"); // after cut-off -> tomorrow
  assert.equal(R.earliestDate(rules, "Abu Dhabi", at(TUE, "08:00")), "2026-11-11"); // no same-day
  // Wed 11 ok; order after cut-off on Wed -> Thu 12 is blackout -> Fri 13 closed weekday -> Sat 14
  assert.equal(R.earliestDate(rules, "Dubai", at("2026-11-11", "15:00")), "2026-11-14");
  assert.equal(R.isDeliverableDate(rules, "2026-11-13"), false, "Friday closed");
  assert.equal(R.isDeliverableDate(rules, "2026-11-12"), false, "blackout");
  // everything closed -> null
  assert.equal(R.earliestDate({ ...rules, closedWeekdays: [0, 1, 2, 3, 4, 5, 6] }, "Dubai", at(TUE, "10:00")), null);
  ok("earliest date skips closed weekdays and blackout dates; none bookable -> null");

  // ---- fees
  const dubai = rules.zones[0], ad = rules.zones[1];
  assert.equal(R.deliveryFeeFils(dubai, 49_999), 2500);
  assert.equal(R.deliveryFeeFils(dubai, 50_000), 0, "free_over is inclusive");
  assert.equal(R.deliveryFeeFils(ad, 1_000_000), 1550, "no free_over -> always charged");
  assert.equal(R.deliveryVatFils(2500), 125);
  assert.equal(R.deliveryVatFils(1550), 78, "15.50 x 5% = 0.775 -> 0.78 (round half up)");
  ok("fee tiers, inclusive free-delivery threshold, and 5% VAT rounding on the fee");

  // ---- validation messages
  const v = (o: Partial<{ emirate: string; date: string; slot: string; goodsFils: number; now: Date }>) =>
    R.validateDelivery(rules, { emirate: o.emirate ?? "Dubai", date: o.date, slot: o.slot, goodsFils: o.goodsFils ?? 10_000 }, o.now ?? at(TUE, "10:00"));
  const code = (r: ReturnType<typeof v>) => (r.ok ? "ok" : r.code);
  assert.equal(code(v({ emirate: "Sharjah", date: TUE, slot: "evening" })), "zone_disabled");
  assert.equal(code(v({ emirate: "Fujairah", date: TUE, slot: "evening" })), "zone_disabled", "unknown zone");
  assert.equal(code(v({ slot: "morning" })), "date_required");
  assert.equal(code(v({ date: "2026-11-09", slot: "morning" })), "date_unavailable", "in the past");
  assert.equal(code(v({ date: TUE, slot: "morning", now: at(TUE, "14:00") })), "date_unavailable", "same-day after cut-off");
  assert.equal(code(v({ date: "2026-11-13", slot: "morning" })), "date_unavailable", "closed Friday");
  assert.equal(code(v({ date: "2026-11-12", slot: "morning" })), "date_unavailable", "blackout");
  assert.equal(code(v({ date: "2027-01-30", slot: "morning" })), "date_too_far");
  assert.equal(code(v({ date: TUE, slot: "morning" })), "slot_too_soon", "10:00 now, 09:00 window already passed");
  assert.equal(code(v({ date: TUE, slot: "midnight" })), "slot_invalid");
  assert.equal(code(v({ date: TUE, slot: "evening" })), "ok");
  const good = v({ date: "2026-11-11", slot: "morning", goodsFils: 20_000 });
  assert(good.ok && good.feeFils === 2500 && good.vatFils === 125 && good.slotLabel.startsWith("Morning"));
  ok("validateDelivery rejects every bad case with a specific code and accepts a good one");

  // ---- database: placeOrder with fees (clock fixed so dates are deterministic)
  const fyNow = financialYear();
  const counterBefore = await counterSnapshot(pool, fyNow);
  const [p] = await db.select().from(products).where(eq(products.status, "active")).limit(1);
  const qty = Math.max(p.min_order_qty, 1);
  const sel = new Map([[p.id, { qty, vessel: false, months: 1 }]]);
  const mk = (over: Record<string, unknown>, email: string) =>
    orderInputSchema.parse({
      customer: { name: "Delivery Bot", email, phone: "+971500000000" },
      emirate: "Dubai",
      address: { line1: "1 Test" },
      paymentMethod: "card",
      items: [{ productId: p.id, qty }],
      locale: "en",
      acceptTerms: true,
      deliveryDate: "2026-11-11",
      deliverySlot: "morning",
      ...over,
    });
  try {
    await cleanupVerifyData(pool, fyNow, counterBefore);
    const now = at(TUE, "10:00");

    const placed = await placeOrder(mk({}, "d1@verify.test"), sel, null, null, rules, now);
    assert(placed.ok);
    const [o] = await db.select().from(orders).where(eq(orders.id, placed.order.id));
    const goods = Math.round(o.subtotal * 100);
    const feeExpected = goods >= 50_000 ? 0 : 2500;
    assert.equal(Math.round(o.delivery_fee * 100), feeExpected);
    const lineVat = placed.lines.reduce((s, l) => s + l.vatFils, 0);
    assert.equal(Math.round(o.delivery_vat * 100), Math.round((feeExpected * 5) / 100));
    assert.equal(Math.round(o.vat * 100), lineVat + Math.round(o.delivery_vat * 100), "order VAT includes VAT on delivery");
    assert.equal(
      Math.round(o.total * 100),
      goods + Math.round(o.vat * 100) + Math.round(o.deposit_total * 100) + Math.round(o.delivery_fee * 100),
    );
    assert.equal(o.delivery_date, "2026-11-11");
    ok(`order stores fee (AED ${o.delivery_fee}), VAT on the fee, and a total that adds up`);

    // force a fee for a deterministic invoice + Stripe check (low-value free_over)
    const paidRules = { ...rules, zones: rules.zones.map((z) => (z.emirate === "Abu Dhabi" ? { ...z, fee: 15.5 } : z)) };
    const ab = await placeOrder(mk({ emirate: "Abu Dhabi" }, "d2@verify.test"), sel, null, null, paidRules, now);
    assert(ab.ok);
    const [o2] = await db.select().from(orders).where(eq(orders.id, ab.order.id));
    assert.equal(o2.delivery_fee, 15.5);
    assert.equal(o2.delivery_vat, 0.78);
    const items = buildStripeLineItems({ lines: ab.lines, deliveryFils: ab.deliveryFils, vatFils: ab.vatFils, depositFils: ab.depositFils });
    assert.equal(stripeTotalFils(items), Math.round(o2.total * 100), "what Stripe charges == orders.total (the webhook checks this)");
    assert(items.some((i) => i.price_data.product_data.name === "Delivery" && i.price_data.unit_amount === 1550));
    ok("Stripe line items (goods + Delivery + VAT incl. delivery VAT + deposit) sum exactly to the order total");

    await markOrderPaid({ id: ab.order.id }, "system", { note: "verify" });
    const [inv] = await db.select().from(invoices).where(eq(invoices.order_id, ab.order.id));
    assert.equal(inv.delivery_fee, 15.5);
    assert.equal(inv.delivery_vat, 0.78);
    const lineVatSum = ab.lines.reduce((s, l) => s + l.vatFils, 0);
    assert.equal(Math.round(inv.vat * 100), lineVatSum + 78);
    assert.equal(Math.round((inv.subtotal + inv.delivery_fee + inv.vat + inv.deposit_total) * 100), Math.round(inv.total * 100));
    ok("invoice snapshots the delivery fee + its VAT; taxable + VAT + deposit = total");

    // ---- server refuses what the rules refuse (the browser can't talk its way past them)
    const refuse = async (over: Record<string, unknown>, n: Date, why: string, email: string) => {
      const r = await placeOrder(mk(over, email), sel, null, null, rules, n);
      assert(!r.ok && r.reason === "delivery", why);
    };
    await refuse({ emirate: "Sharjah" }, now, "disabled emirate", "r1@verify.test");
    await refuse({ deliveryDate: TUE, deliverySlot: "evening" }, at(TUE, "14:30"), "same-day after cut-off", "r2@verify.test");
    await refuse({ deliveryDate: "2026-11-13" }, now, "closed weekday", "r3@verify.test");
    await refuse({ deliveryDate: "2026-11-12" }, now, "blackout date", "r4@verify.test");
    await refuse({ deliveryDate: TUE, deliverySlot: "morning" }, now, "slot already too soon", "r5@verify.test");
    await refuse({ emirate: "Abu Dhabi", deliveryDate: TUE, deliverySlot: "evening" }, now, "same-day to a zone that has none", "r6@verify.test");
    assert.equal((await pool.query("SELECT COUNT(*) n FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE email LIKE 'r%@verify.test')") as unknown as [{ n: number }[]])[0][0].n, 0, "refused orders leave nothing behind");
    ok("server refuses: disabled emirate, same-day after cut-off, closed day, blackout, slot too soon, same-day without zone support (no rows left behind)");
    // validator: date and slot are mandatory
    assert.throws(() => orderInputSchema.parse({ ...mk({}, "x@verify.test"), deliveryDate: undefined }));
    assert.throws(() => orderInputSchema.parse({ ...mk({}, "x@verify.test"), deliverySlot: "now" }));
    ok("delivery date and a valid slot are required by the order validator");
  } finally {
    await cleanupVerifyData(pool, fyNow, counterBefore);
    await pool.end();
  }
  console.log(out.join("\n"));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
