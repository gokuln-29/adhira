// Evidence script for discount codes.  npm run verify:coupons
import "./_env";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";

async function main() {
  if (/prod/i.test(process.env.DATABASE_URL ?? "")) throw new Error("refusing: production-looking DATABASE_URL");
  const C = await import("../src/lib/offers/coupon");
  const { db, pool } = await import("../src/lib/db");
  const { products, orders, order_items, invoices, offers, offer_targets, offer_redemptions } = await import("../src/lib/db/schema");
  const { placeOrder } = await import("../src/lib/orders/place-order");
  const { markOrderPaid, transitionOrder } = await import("../src/lib/orders/transitions");
  const { getDeliveryRulesFresh } = await import("../src/lib/data/delivery");
  const { orderInputSchema } = await import("../src/lib/validators/order");
  const { buildStripeLineItems, stripeTotalFils } = await import("../src/lib/stripe/line-items");
  const { financialYear } = await import("../src/lib/invoices/number");
  const { cleanupVerifyData, counterSnapshot, testDeliveryDate } = await import("./_testing");
  const out: string[] = [];
  const ok = (m: string) => out.push(`PASS ${m}`);

  // ---------- pure maths
  assert.equal(C.couponDiscountFils({ type: "percent", value: 10 }, 12_345), 1235); // 1234.5 -> 1235
  assert.equal(C.couponDiscountFils({ type: "flat", value: 50 }, 100_000), 5000);
  assert.equal(C.couponDiscountFils({ type: "flat", value: 500 }, 10_000), 10_000, "a flat discount can't exceed the eligible total");
  assert.equal(C.couponDiscountFils({ type: "percent", value: 100 }, 777), 777);
  assert.equal(C.couponDiscountFils({ type: "percent", value: 10 }, 0), 0);
  ok("discount: percent rounding, flat, capped at the eligible total, nothing when nothing is eligible");

  let seed = 12345;
  const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n);
  for (let k = 0; k < 2000; k++) {
    const n = 1 + rnd(6);
    const w = Array.from({ length: n }, () => 1 + rnd(50_000));
    const total = rnd(w.reduce((a, b) => a + b, 0) + 1);
    const parts = C.allocateProportionally(total, w);
    assert.equal(parts.reduce((a, b) => a + b, 0), total);
    assert(parts.every((p, i) => p >= 0 && p <= w[i]), "no line is discounted below zero");
  }
  ok("2,000 random splits: allocated pieces always add up to the exact discount and never exceed a line");

  const r = C.applyCoupon({ type: "percent", value: 10 }, [
    { lineFils: 10_000, vatRate: 5, eligible: true },
    { lineFils: 5_000, vatRate: 5, eligible: false },
    { lineFils: 3_333, vatRate: 5, eligible: true },
  ]);
  assert.equal(r.eligibleFils, 13_333);
  assert.equal(r.discountFils, 1333);
  assert.equal(r.lines[1].discountFils, 0);
  assert.equal(r.lines[0].discountFils + r.lines[2].discountFils, 1333);
  assert.equal(r.lines[0].vatFils, Math.round((r.lines[0].netFils * 5) / 100));
  ok("only eligible lines are discounted; VAT is recomputed on each net line");

  assert.equal(C.couponWindowOpen("2026-11-10T00:00:00.000Z", "2026-11-12T00:00:00.000Z", "2026-11-09"), "not_started");
  assert.equal(C.couponWindowOpen("2026-11-10T00:00:00.000Z", "2026-11-12T00:00:00.000Z", "2026-11-10"), "open");
  assert.equal(C.couponWindowOpen("2026-11-10T00:00:00.000Z", "2026-11-12T00:00:00.000Z", "2026-11-12"), "open", "the last day is included");
  assert.equal(C.couponWindowOpen("2026-11-10T00:00:00.000Z", "2026-11-12T00:00:00.000Z", "2026-11-13"), "expired");
  assert.equal(C.couponWindowOpen(null, null, "2030-01-01"), "open");
  ok("date window: first and last day inclusive");

  // ---------- database
  const fyNow = financialYear();
  const counterBefore = await counterSnapshot(pool, fyNow);
  const rules = await getDeliveryRulesFresh();
  const active = await db.select().from(products).where(eq(products.status, "active"));
  const simple = active.filter((p) => !p.is_rental && !p.allows_vessel && p.min_order_qty === 1 && p.min_order_value === 0 && p.stock_qty === null && p.category_id);
  const A = simple[0];
  const B = simple.find((p) => p.category_id !== A.category_id)!;
  assert(A && B, "need two simple products in different categories");
  const tag = `T${Date.now().toString(36).toUpperCase()}`;
  const mkOffer = async (code: string, o: Partial<typeof offers.$inferInsert> = {}) => {
    const id = crypto.randomUUID();
    await db.insert(offers).values({ id, title: `verify ${code}`, type: "percent", value: 10, code: `${tag}${code}`, scope: "all", active: true, ...o });
    return { id, code: `${tag}${code}` };
  };
  const days = (n: number) => new Date(Date.now() + n * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" }) + "T00:00:00.000Z";
  const input = (email: string, couponCode: string | undefined, items: { p: typeof A; qty: number }[]) =>
    orderInputSchema.parse({
      customer: { name: "Coupon Bot", email, phone: "+971500000000" },
      emirate: "Dubai", address: { line1: "1 Test" }, paymentMethod: "card",
      items: items.map((i) => ({ productId: i.p.id, qty: i.qty })), couponCode,
      locale: "en", acceptTerms: true, deliveryDate: testDeliveryDate(), deliverySlot: "morning",
    });
  const place = (email: string, code: string | undefined, items: { p: typeof A; qty: number }[]) =>
    placeOrder(input(email, code, items), new Map(items.map((i) => [i.p.id, { qty: i.qty, vessel: false, months: 1 }])), null, null, rules);
  const created: string[] = [];

  try {
    await cleanupVerifyData(pool, fyNow, counterBefore);

    // --- a normal percent code, end to end
    const pct = await mkOffer("PCT", { value: 10 });
    created.push(pct.id);
    const lowercaseWithSpaces = ` ${pct.code.toLowerCase()} `;
    const p1 = await place("c1@verify.test", lowercaseWithSpaces, [{ p: A, qty: 3 }, { p: B, qty: 2 }]);
    assert(p1.ok, p1.ok ? "" : p1.message);
    ok("code is matched case-insensitively and trimmed");
    const [o1] = await db.select().from(orders).where(eq(orders.id, p1.order.id));
    const items1 = await db.select().from(order_items).where(eq(order_items.order_id, o1.id));
    const gross = items1.reduce((s, i) => s + Math.round((i.line_total + i.discount) * 100), 0);
    const disc = items1.reduce((s, i) => s + Math.round(i.discount * 100), 0);
    assert.equal(disc, Math.round((gross * 10) / 100), "10% of the eligible goods, rounded to the fils");
    assert.equal(disc, Math.round(o1.discount_total * 100));
    assert.equal(Math.round(o1.subtotal * 100), gross - disc, "subtotal is net of the discount");
    const vatLines = items1.reduce((s, i) => s + Math.round(i.vat * 100), 0);
    assert.equal(Math.round(o1.vat * 100), vatLines + Math.round(o1.delivery_vat * 100));
    for (const i of items1) assert.equal(Math.round(i.vat * 100), Math.round((Math.round(i.line_total * 100) * 5) / 100), "VAT is on the discounted amount");
    assert.equal(Math.round(o1.total * 100), Math.round(o1.subtotal * 100) + Math.round(o1.vat * 100) + Math.round(o1.deposit_total * 100) + Math.round(o1.delivery_fee * 100));
    assert.equal(o1.coupon_code, pct.code);
    assert.equal(o1.offer_id, pct.id);
    assert.equal((await db.select().from(offer_redemptions).where(eq(offer_redemptions.order_id, o1.id))).length, 1);
    ok("10% off: lines are net, VAT is charged on the discounted amount, totals add up, redemption recorded");

    const stripeItems = buildStripeLineItems({ lines: p1.lines, deliveryFils: p1.deliveryFils, vatFils: p1.vatFils, depositFils: p1.depositFils });
    assert.equal(stripeTotalFils(stripeItems), Math.round(o1.total * 100));
    ok("Stripe line items (discounted lines sent at net price) sum exactly to the order total");

    await markOrderPaid({ id: o1.id }, "system");
    const [inv] = await db.select().from(invoices).where(eq(invoices.order_id, o1.id));
    assert.equal(inv.coupon_code, pct.code);
    assert.equal(Math.round(inv.discount_total * 100), disc);
    assert.equal(Math.round((inv.subtotal + inv.delivery_fee + inv.vat + inv.deposit_total) * 100), Math.round(inv.total * 100));
    ok("invoice snapshots the coupon code and discount; taxable + VAT + deposit = total");

    // --- scope
    const cat = await mkOffer("CAT", { scope: "category", value: 50 });
    created.push(cat.id);
    await db.insert(offer_targets).values({ offer_id: cat.id, kind: "category", target_id: A.category_id! });
    const p2 = await place("c2@verify.test", cat.code, [{ p: A, qty: 2 }, { p: B, qty: 2 }]);
    assert(p2.ok);
    const lineA = p2.lines.find((l) => l.productId === A.id)!, lineB = p2.lines.find((l) => l.productId === B.id)!;
    assert(lineA.discountFils > 0 && lineB.discountFils === 0);
    assert.equal(lineA.discountFils, Math.round(lineA.grossFils * 0.5));
    ok("category scope: only products in the chosen category are discounted");
    const prod = await mkOffer("PROD", { scope: "product", type: "flat", value: 10 });
    created.push(prod.id);
    await db.insert(offer_targets).values({ offer_id: prod.id, kind: "product", target_id: B.id });
    const p3 = await place("c3@verify.test", prod.code, [{ p: A, qty: 1 }, { p: B, qty: 1 }]);
    assert(p3.ok && p3.discountFils === 1000 && p3.lines.find((l) => l.productId === A.id)!.discountFils === 0);
    ok("product scope: a flat AED 10 comes off the chosen product only");
    const none = await place("c4@verify.test", prod.code, [{ p: A, qty: 1 }]);
    assert(!none.ok && none.reason === "coupon" && /doesn.t apply/.test(none.message));
    ok("a code that matches nothing in the cart is refused");

    // --- rules: invalid, window, min spend
    const expired = await mkOffer("OLD", { ends: days(-1) });
    const future = await mkOffer("FUT", { starts: days(2) });
    const off = await mkOffer("OFF", { active: false });
    const legacy = await mkOffer("LEG", { type: "code" });
    const lastDay = await mkOffer("LAST", { ends: days(0) });
    created.push(expired.id, future.id, off.id, legacy.id, lastDay.id);
    const msg = async (code: string) => { const r = await place("c5@verify.test", code, [{ p: A, qty: 1 }]); return r.ok ? "OK" : r.message; };
    assert.match(await msg(expired.code), /expired/);
    assert.match(await msg(future.code), /isn't active yet/);
    assert.match(await msg(off.code), /isn't valid/);
    assert.match(await msg(legacy.code), /isn't valid/);
    assert.match(await msg("NOSUCHCODE"), /isn't valid/);
    assert.equal(await msg(lastDay.code), "OK", "a code is valid through its last day");
    ok("expired / not yet active / switched off / old 'code-only' type / unknown: refused; last day still works");

    const min = await mkOffer("MIN", { min_subtotal: 1000 });
    created.push(min.id);
    const small = await place("c6@verify.test", min.code, [{ p: A, qty: 1 }]);
    if (A.base_price < 1000) assert(!small.ok && /at least AED 1000/.test(small.message));
    const big = await place("c6@verify.test", min.code, [{ p: A, qty: Math.ceil(1000 / A.base_price) + 1 }]);
    assert(big.ok);
    ok("minimum spend: refused below, accepted above (eligible goods before VAT)");

    // --- a code that would make the order (almost) free
    const nearlyFree = await mkOffer("FREE", { type: "flat", value: 100_000 });
    created.push(nearlyFree.id);
    const free = await place("c7@verify.test", nearlyFree.code, [{ p: A, qty: 1 }]);
    assert(!free.ok && /below AED 2/.test(free.message));
    ok("a code that would take the total below AED 2 is refused");

    // --- usage limits
    const lim = await mkOffer("LIM", { max_uses: 2 });
    created.push(lim.id);
    const racers = await Promise.all(Array.from({ length: 5 }, (_, i) => place(`lim${i}@verify.test`, lim.code, [{ p: A, qty: 1 }])));
    const winners = racers.filter((x) => x.ok);
    assert.equal(winners.length, 2, `max_uses=2 under 5 simultaneous checkouts -> exactly 2 redeem (got ${winners.length})`);
    assert(racers.filter((x) => !x.ok).every((x) => !x.ok && /fully used/.test(x.message)));
    ok("max uses = 2 with 5 simultaneous checkouts -> exactly 2 succeed, the rest are told it's fully used");
    // cancelling gives the use back
    const w = winners[0];
    assert(w.ok);
    await transitionOrder({ id: w.order.id }, "cancelled", "system", "verify");
    const again = await place("lim9@verify.test", lim.code, [{ p: A, qty: 1 }]);
    assert(again.ok);
    const afterThat = await place("lim10@verify.test", lim.code, [{ p: A, qty: 1 }]);
    assert(!afterThat.ok);
    ok("a cancelled order gives its use back (and the limit still holds afterwards)");

    const once = await mkOffer("ONCE", { max_uses_per_customer: 1 });
    created.push(once.id);
    assert((await place("Same@Verify.test", once.code, [{ p: A, qty: 1 }])).ok);
    const dup = await place("same@verify.test", once.code, [{ p: A, qty: 1 }]);
    assert(!dup.ok && /already used/.test(dup.message), "email match ignores case");
    assert((await place("other@verify.test", once.code, [{ p: A, qty: 1 }])).ok);
    ok("per-customer limit (by email, case-insensitive): second try refused, another customer fine");

    // refused attempts leave no order behind
    const stray = await pool.query("SELECT COUNT(*) n FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE email IN ('c4@verify.test','c7@verify.test'))") as unknown as [{ n: number }[]];
    assert.equal(stray[0][0].n, 0);
    ok("refused coupon attempts leave no orders behind");
  } finally {
    await pool.query("DELETE FROM offers WHERE code LIKE ?", [`${tag}%`]);
    await cleanupVerifyData(pool, fyNow, counterBefore);
    await pool.end();
  }
  console.log(out.join("\n"));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
