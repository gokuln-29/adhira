// Evidence script for stock status, low/out-of-stock alerts and restocking.  npm run verify:stock
import "./_env";
import assert from "node:assert/strict";
import http from "node:http";
import { eq } from "drizzle-orm";

async function main() {
  if (/prod/i.test(process.env.DATABASE_URL ?? "")) throw new Error("refusing: production-looking DATABASE_URL");
  const sent: { to: string; subject: string }[] = [];
  const mock = http.createServer((req, res) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      try {
        const j = JSON.parse(b);
        sent.push({ to: j.to?.[0]?.email, subject: j.subject });
      } catch {}
      res.writeHead(201).end("{}");
    });
  });
  await new Promise<void>((r) => mock.listen(9912, "127.0.0.1", r));
  process.env.BREVO_API_URL = "http://127.0.0.1:9912";
  process.env.BREVO_API_KEY = "x";
  process.env.EMAIL_FROM = "a@verify.test";
  process.env.ALERT_EMAIL = "ops@verify.test";

  const { stockStatus } = await import("../src/lib/stock");
  const { db, pool } = await import("../src/lib/db");
  const { products, store_settings, ops_alerts } = await import("../src/lib/db/schema");
  const { syncStockAlerts, getLowStockProducts } = await import("../src/lib/ops/stock");
  const { placeOrder } = await import("../src/lib/orders/place-order");
  const { transitionOrder } = await import("../src/lib/orders/transitions");
  const { getDeliveryRulesFresh } = await import("../src/lib/data/delivery");
  const { orderInputSchema } = await import("../src/lib/validators/order");
  const { financialYear } = await import("../src/lib/invoices/number");
  const { cleanupVerifyData, counterSnapshot, testDeliveryDate } = await import("./_testing");
  const out: string[] = [];
  const ok = (m: string) => out.push(`PASS ${m}`);
  const settle = () => new Promise((r) => setTimeout(r, 600));

  assert.equal(stockStatus(null, 5), "untracked");
  assert.equal(stockStatus(0, 5), "out");
  assert.equal(stockStatus(-2, 5), "out");
  assert.equal(stockStatus(1, 5), "low");
  assert.equal(stockStatus(5, 5), "low", "at the level counts as low");
  assert.equal(stockStatus(6, 5), "ok");
  assert.equal(stockStatus(0, 0), "out");
  ok("status: untracked / out / low (inclusive) / ok");

  const fyNow = financialYear();
  const counterBefore = await counterSnapshot(pool, fyNow);
  const tag = `vs${Date.now().toString(36)}`;
  const [{ t: oldThreshold }] = await db.select({ t: store_settings.low_stock_threshold }).from(store_settings);
  await db.update(store_settings).set({ low_stock_threshold: 5 }).where(eq(store_settings.id, 1));
  const mk = async (slug: string, stock: number | null, status: "active" | "draft" = "active") => {
    const id = crypto.randomUUID();
    await db.insert(products).values({ id, name: `Verify ${slug}`, slug: `${tag}-${slug}`, details: [], base_price: 10, status, tags: [], stock_qty: stock });
    return id;
  };
  const alertsFor = async (id: string) =>
    (await db.select().from(ops_alerts)).filter((a) => a.ref.endsWith(id)).map((a) => ({ kind: a.kind, open: !a.resolved_at, occ: a.occurrences }));
  const mails = () => sent.filter((m) => m.subject.includes("stock"));

  try {
    await cleanupVerifyData(pool, fyNow, counterBefore);
    await pool.query("DELETE FROM ops_alerts");

    const a = await mk("a", 10);
    const untracked = await mk("u", null);
    const draft = await mk("d", 0, "draft");
    const fine = await mk("f", 6);
    await syncStockAlerts([a, untracked, draft, fine]);
    await settle();
    assert.equal((await db.select().from(ops_alerts)).length, 0, "nothing to alert about");
    ok("well-stocked, untracked and draft products raise no alerts");

    await db.update(products).set({ stock_qty: 4 }).where(eq(products.id, a));
    await syncStockAlerts([a]);
    await syncStockAlerts([a]);
    await syncStockAlerts([a]);
    await settle();
    assert.deepEqual(await alertsFor(a), [{ kind: "low_stock", open: true, occ: 1 }]);
    assert.equal(mails().filter((m) => m.subject.startsWith("[Adhira Flowers ALERT] Low stock")).length, 1);
    ok("dropping to 4 raises ONE low-stock alert and ONE email, however often it is re-checked");

    await db.update(products).set({ stock_qty: 2 }).where(eq(products.id, a));
    await syncStockAlerts([a]);
    await settle();
    assert.equal(mails().length, 1, "going from 4 to 2 doesn't email again");
    ok("4 → 2 stays the same alert (no extra email)");

    await db.update(products).set({ stock_qty: 0 }).where(eq(products.id, a));
    await syncStockAlerts([a]);
    await settle();
    const s0 = await alertsFor(a);
    assert(s0.some((x) => x.kind === "low_stock" && !x.open) && s0.some((x) => x.kind === "out_of_stock" && x.open));
    assert.equal(mails().filter((m) => m.subject.includes("Out of stock")).length, 1);
    ok("hitting 0 closes the low alert and raises an out-of-stock alert + email");

    const low = await getLowStockProducts();
    assert(low.items.some((i) => i.id === a && i.status === "out"));
    assert(!low.items.some((i) => [untracked, draft, fine].includes(i.id)));
    assert.equal(low.items.find((i) => i.id === a)!.stock_qty, 0);
    ok("the dashboard list has the out-of-stock product and excludes untracked / draft / well-stocked ones");

    await db.update(products).set({ stock_qty: 20 }).where(eq(products.id, a));
    await syncStockAlerts([a]);
    assert((await alertsFor(a)).every((x) => !x.open));
    ok("restocking above the level resolves the alerts by itself");

    // alert level change
    await db.update(products).set({ stock_qty: 8 }).where(eq(products.id, fine));
    await db.update(store_settings).set({ low_stock_threshold: 10 }).where(eq(store_settings.id, 1));
    await syncStockAlerts();
    await settle();
    assert((await alertsFor(fine)).some((x) => x.kind === "low_stock" && x.open), "raising the level to 10 makes 8 units 'low'");
    await db.update(store_settings).set({ low_stock_threshold: 5 }).where(eq(store_settings.id, 1));
    await syncStockAlerts();
    assert((await alertsFor(fine)).every((x) => !x.open), "lowering it again clears it");
    ok("changing the alert level re-evaluates every tracked product");

    // real order flow: place -> stock down -> sync raises; cancel -> restock -> alert clears
    const rules = await getDeliveryRulesFresh();
    const p = await mk("order", 7);
    const input = orderInputSchema.parse({
      customer: { name: "Stock Bot", email: "stock@verify.test", phone: "+971500000000" },
      emirate: "Dubai", address: { line1: "1 Test" }, paymentMethod: "card",
      items: [{ productId: p, qty: 3 }], locale: "en", acceptTerms: true, deliveryDate: testDeliveryDate(), deliverySlot: "morning",
    });
    const placed = await placeOrder(input, new Map([[p, { qty: 3, vessel: false, months: 1 }]]), null, null, rules);
    assert(placed.ok);
    assert.equal((await db.select().from(products).where(eq(products.id, p)))[0].stock_qty, 4);
    await syncStockAlerts([p]); // what createOrder does after the response
    await settle();
    assert((await alertsFor(p)).some((x) => x.kind === "low_stock" && x.open));
    ok("an order that takes stock from 7 to 4 raises a low-stock alert");
    const over = await placeOrder(
      orderInputSchema.parse({ ...input, customer: { ...input.customer, email: "stock2@verify.test" }, items: [{ productId: p, qty: 5 }] }),
      new Map([[p, { qty: 5, vessel: false, months: 1 }]]), null, null, rules,
    );
    assert(!over.ok && over.reason === "stock" && /only 4 left/.test(over.message));
    ok("ordering more than what's left is refused ('only 4 left') and takes nothing");
    await transitionOrder({ id: placed.order.id }, "cancelled", "system", "verify"); // restock + sync happen inside
    assert.equal((await db.select().from(products).where(eq(products.id, p)))[0].stock_qty, 7);
    assert((await alertsFor(p)).every((x) => !x.open));
    ok("cancelling the order restocks 7 and the low-stock alert clears itself");
  } finally {
    await db.update(store_settings).set({ low_stock_threshold: oldThreshold }).where(eq(store_settings.id, 1));
    await pool.query("DELETE FROM ops_alerts");
    await pool.query("DELETE FROM products WHERE slug LIKE ?", [`${tag}%`]);
    await cleanupVerifyData(pool, fyNow, counterBefore);
    mock.close();
    await pool.end();
  }
  console.log(out.join("\n"));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
