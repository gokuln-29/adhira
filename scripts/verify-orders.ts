// Evidence script for the order engine against a real MySQL (never production!).
//   npm run verify:orders
// Checks: simultaneous checkouts can't oversell, idempotency replay returns the
// same order, the state machine rejects illegal moves + audits, cancel restocks,
// COD is never auto-paid, payment is idempotent.
import "./_env";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";

async function main() {
  if (/prod/i.test(process.env.DATABASE_URL ?? "")) throw new Error("refusing to run against a production-looking URL");
  const { db, pool } = await import("../src/lib/db");
  const { products, orders, order_status_events } = await import("../src/lib/db/schema");
  const { placeOrder } = await import("../src/lib/orders/place-order");
  const { transitionOrder, markOrderPaid } = await import("../src/lib/orders/transitions");

  const [p] = await db.select().from(products).where(eq(products.status, "active")).limit(1);
  assert(p, "need an active product");
  const original = p.stock_qty;
  const sel = new Map([[p.id, { qty: p.min_order_qty, vessel: false, months: 1 }]]);
  const { orderInputSchema } = await import("../src/lib/validators/order");
  const baseInput = (email: string) => orderInputSchema.parse({
    customer: { name: "Verify Bot", email, phone: "+971500000000" },
    emirate: "Dubai" as const,
    address: { line1: "1 Test Street" },
    paymentMethod: "cod" as const,
    items: [{ productId: p.id, qty: p.min_order_qty, vessel: false, months: 1 }],
    locale: "en" as const,
    acceptTerms: true as const,
  });
  const results: string[] = [];
  const ok = (name: string) => results.push(`PASS ${name}`);

  try {
    // 1. oversell: stock for exactly one order, 8 concurrent checkouts
    await db.update(products).set({ stock_qty: p.min_order_qty }).where(eq(products.id, p.id));
    const runs = await Promise.all(
      Array.from({ length: 8 }, (_, i) => placeOrder(baseInput(`race${i}@verify.test`), sel, null, null)),
    );
    const won = runs.filter((r) => r.ok);
    const lost = runs.filter((r) => !r.ok);
    assert.equal(won.length, 1, `exactly one checkout may win, got ${won.length}`);
    assert(lost.every((r) => !r.ok && r.reason === "stock"));
    const [after1] = await db.select().from(products).where(eq(products.id, p.id));
    assert.equal(after1.stock_qty, 0);
    ok("8 concurrent checkouts of the last unit -> exactly 1 order, stock 0");

    // 2. cancel restocks
    const first = won[0]!;
    assert(first.ok);
    assert.equal((await transitionOrder({ id: first.order.id }, "cancelled", "system", "verify")).ok, true);
    const [after2] = await db.select().from(products).where(eq(products.id, p.id));
    assert.equal(after2.stock_qty, p.min_order_qty);
    ok("cancelling restocks the product");
    const again = await transitionOrder({ id: first.order.id }, "confirmed", "system");
    assert.equal(again.ok, false);
    ok("cancelled order cannot be re-opened");

    // 3. idempotency
    await db.update(products).set({ stock_qty: null }).where(eq(products.id, p.id));
    const key = `verify-${Date.now()}-abcdefgh`;
    const [a, b] = await Promise.all([
      placeOrder(baseInput("idem@verify.test"), sel, key, null),
      placeOrder(baseInput("idem@verify.test"), sel, key, null),
    ]);
    assert(a.ok && b.ok);
    assert.equal(a.order.id, b.order.id);
    assert.equal([a, b].filter((r) => r.ok && !r.replay).length, 1);
    ok("same idempotency key (concurrent) -> one order, one replay");

    // 4. state machine + audit + COD never auto-paid
    const id = a.order.id;
    const [o1] = await db.select().from(orders).where(eq(orders.id, id));
    assert.equal(o1.payment_status, "unpaid");
    assert.equal((await transitionOrder({ id }, "delivered", "system")).ok, false);
    ok("pending -> delivered rejected");
    for (const s of ["confirmed", "preparing", "dispatched", "delivered"] as const) {
      assert.equal((await transitionOrder({ id }, s, "admin:verify")).ok, true, s);
    }
    const [o2] = await db.select().from(orders).where(eq(orders.id, id));
    assert.equal(o2.payment_status, "unpaid", "COD must stay unpaid until staff confirm cash");
    ok("COD order walked to delivered and is still UNPAID");
    const events = await db.select().from(order_status_events).where(eq(order_status_events.order_id, id));
    assert.equal(events.length, 5);
    ok("audit trail has 5 events (placed + 4 transitions)");

    // 5. payment idempotent
    const r1 = await markOrderPaid({ id }, "admin:verify", { note: "verify" });
    const r2 = await markOrderPaid({ id }, "admin:verify", { note: "verify" });
    assert(r1.ok && r1.changed && r2.ok && !r2.changed);
    ok("marking paid twice changes once");
  } finally {
    await db.update(products).set({ stock_qty: original }).where(eq(products.id, p.id));
    await pool.query("DELETE FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE email LIKE '%@verify.test')");
    await pool.query("DELETE FROM customers WHERE email LIKE '%@verify.test'");
    await pool.end();
  }
  console.log(results.join("\n"));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
