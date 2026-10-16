// Exercises the real /api/stripe/webhook route with correctly (and incorrectly)
// signed events against a running dev server + local MySQL. Uses only the
// webhook secret from .env.local; never talks to Stripe.
//   npm run dev   (other terminal)   then   npm run verify:webhook
import "./_env";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";

async function main() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET!;
  if (/prod/i.test(process.env.DATABASE_URL ?? "")) throw new Error("refusing: production-looking DATABASE_URL");
  const { db, pool } = await import("../src/lib/db");
  const { orders, products, stripe_events, order_status_events } = await import("../src/lib/db/schema");
  const { placeOrder } = await import("../src/lib/orders/place-order");
  const { orderInputSchema } = await import("../src/lib/validators/order");
  const stripe = new Stripe("sk_test_unused");
  const out: string[] = [];
  const ok = (m: string) => out.push(`PASS ${m}`);

  const [p] = await db.select().from(products).where(eq(products.status, "active")).limit(1);
  const mkOrder = async (tag: string) => {
    const input = orderInputSchema.parse({
      customer: { name: "Webhook Bot", email: `${tag}@verify.test`, phone: "+971500000000" },
      emirate: "Dubai", address: { line1: "1 Test St" }, paymentMethod: "card",
      items: [{ productId: p.id, qty: p.min_order_qty }], locale: "en", acceptTerms: true,
    });
    const r = await placeOrder(input, new Map([[p.id, { qty: p.min_order_qty, vessel: false, months: 1 }]]), null, null);
    assert(r.ok);
    const sessionId = `cs_test_${tag}_${Date.now()}`;
    await db.update(orders).set({ stripe_checkout_session_id: sessionId }).where(eq(orders.id, r.order.id));
    const [o] = await db.select().from(orders).where(eq(orders.id, r.order.id));
    return { id: r.order.id, number: r.order.number, sessionId, total: o.total };
  };
  const send = async (event: object, opts: { secret?: string } = {}) => {
    const payload = JSON.stringify(event);
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: opts.secret ?? secret });
    const res = await fetch(`${BASE}/api/stripe/webhook`, { method: "POST", body: payload, headers: { "stripe-signature": header, "content-type": "application/json" } });
    return res.status;
  };
  const evt = (id: string, type: string, session: object) => ({
    id, object: "event", type, api_version: "2024-06-20", created: Math.floor(Date.now() / 1000),
    data: { object: { object: "checkout.session", payment_status: "paid", currency: "aed", payment_intent: "pi_test_1", ...session } },
  });
  const get = async (id: string) => (await db.select().from(orders).where(eq(orders.id, id)))[0];

  try {
    const a = await mkOrder("a");
    // 1. bad signature
    assert.equal(await send(evt("evt_bad", "checkout.session.completed", { id: a.sessionId, amount_total: Math.round(a.total * 100), metadata: { order_number: a.number } }), { secret: "whsec_wrong" }), 400);
    assert.equal((await get(a.id)).payment_status, "unpaid");
    ok("invalid signature -> 400, order untouched");

    // 2. amount mismatch
    assert.equal(await send(evt(`evt_amt_${Date.now()}`, "checkout.session.completed", { id: a.sessionId, amount_total: 100, metadata: { order_number: a.number } })), 200);
    assert.equal((await get(a.id)).payment_status, "unpaid");
    ok("wrong amount -> order NOT marked paid");

    // 3. wrong currency
    assert.equal(await send(evt(`evt_cur_${Date.now()}`, "checkout.session.completed", { id: a.sessionId, currency: "usd", amount_total: Math.round(a.total * 100), metadata: { order_number: a.number } })), 200);
    assert.equal((await get(a.id)).payment_status, "unpaid");
    ok("wrong currency -> order NOT marked paid");

    // 4. session belongs to a different order
    assert.equal(await send(evt(`evt_ses_${Date.now()}`, "checkout.session.completed", { id: "cs_test_someone_else", amount_total: Math.round(a.total * 100), metadata: { order_number: a.number } })), 200);
    assert.equal((await get(a.id)).payment_status, "unpaid");
    ok("session id mismatch -> order NOT marked paid");

    // 5. unpaid async session
    assert.equal(await send(evt(`evt_unp_${Date.now()}`, "checkout.session.completed", { id: a.sessionId, payment_status: "unpaid", amount_total: Math.round(a.total * 100), metadata: { order_number: a.number } })), 200);
    assert.equal((await get(a.id)).payment_status, "unpaid");
    ok("payment_status != paid -> ignored");

    // 6. valid
    const goodId = `evt_good_${Date.now()}`;
    const good = evt(goodId, "checkout.session.completed", { id: a.sessionId, amount_total: Math.round(a.total * 100), metadata: { order_number: a.number } });
    assert.equal(await send(good), 200);
    const paid = await get(a.id);
    assert.equal(paid.payment_status, "paid");
    assert.equal(paid.status, "confirmed");
    assert.equal(paid.stripe_payment_intent_id, "pi_test_1");
    ok("valid event -> paid + confirmed, payment intent recorded");

    // 7. replay
    const eventsBefore = (await db.select().from(order_status_events).where(eq(order_status_events.order_id, a.id))).length;
    assert.equal(await send(good), 200);
    const eventsAfter = (await db.select().from(order_status_events).where(eq(order_status_events.order_id, a.id))).length;
    assert.equal(eventsAfter, eventsBefore);
    const [row] = await db.select().from(stripe_events).where(eq(stripe_events.id, goodId));
    assert.equal(row.outcome, "paid");
    ok("duplicate delivery of the same event id -> no second change");

    // 8. late webhook can't regress an order that moved on
    await db.update(orders).set({ status: "preparing" }).where(eq(orders.id, a.id));
    assert.equal(await send(evt(`evt_late_${Date.now()}`, "checkout.session.completed", { id: a.sessionId, amount_total: Math.round(a.total * 100), metadata: { order_number: a.number } })), 200);
    assert.equal((await get(a.id)).status, "preparing");
    ok("new event for an already-paid order doesn't regress status");

    // 9. expired -> cancelled
    const b = await mkOrder("b");
    assert.equal(await send(evt(`evt_exp_${Date.now()}`, "checkout.session.expired", { id: b.sessionId, payment_status: "unpaid", metadata: { order_number: b.number } })), 200);
    assert.equal((await get(b.id)).status, "cancelled");
    ok("checkout.session.expired -> order cancelled");

    // 10. malformed / unknown order
    assert.equal(await send(evt(`evt_unk_${Date.now()}`, "checkout.session.completed", { id: "cs_x", amount_total: 1, metadata: { order_number: "AF-NOPE" } })), 200);
    ok("unknown order number handled without error");
  } finally {
    await pool.query("DELETE FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE email LIKE '%@verify.test')");
    await pool.query("DELETE FROM customers WHERE email LIKE '%@verify.test'");
    await pool.query("DELETE FROM stripe_events WHERE id LIKE 'evt_%'");
    await pool.end();
  }
  console.log(out.join("\n"));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
