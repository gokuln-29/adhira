// Exercises the real /api/stripe/webhook route with correctly (and incorrectly)
// signed events against a running dev server + local MySQL. Uses only the
// webhook secret from .env.local; never talks to Stripe.
//   npm run dev   (other terminal)   then   npm run verify:webhook
import "./_env";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import http from "node:http";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";

async function main() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET!;
  if (/prod/i.test(process.env.DATABASE_URL ?? "")) throw new Error("refusing: production-looking DATABASE_URL");
  const { db, pool } = await import("../src/lib/db");
  const { financialYear } = await import("../src/lib/invoices/number");
  const { cleanupVerifyData, counterSnapshot } = await import("./_testing");
  const fyNow = financialYear();
  const counterBefore = await counterSnapshot(pool, fyNow);
  const { orders, products, stripe_events, order_status_events } = await import("../src/lib/db/schema");
  const { placeOrder } = await import("../src/lib/orders/place-order");
  const { getDeliveryRulesFresh } = await import("../src/lib/data/delivery");
  const { testDeliveryDate } = await import("./_testing");
  const rules = await getDeliveryRulesFresh();
  const { transitionOrder } = await import("../src/lib/orders/transitions");
  const { orderInputSchema } = await import("../src/lib/validators/order");
  const stripe = new Stripe("sk_test_unused");
  const out: string[] = [];
  const ok = (m: string) => out.push(`PASS ${m}`);

  // Mock Brevo so we can count alert emails. The dev server must be started with
  // BREVO_API_URL=http://127.0.0.1:9911 BREVO_API_KEY=x EMAIL_FROM=a@b.c ALERT_EMAIL=ops@verify.test
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
  await new Promise<void>((r) => mock.listen(9911, "127.0.0.1", r));
  process.env.BREVO_API_URL = "http://127.0.0.1:9911";
  process.env.BREVO_API_KEY = "x";
  process.env.EMAIL_FROM = "a@verify.test";
  process.env.ALERT_EMAIL = "ops@verify.test";
  const alerts = async () => (await pool.query("SELECT kind, ref, occurrences, resolved_at, email_sent_at, order_number FROM ops_alerts ORDER BY created_at"))[0] as { kind: string; ref: string; occurrences: number; resolved_at: string | null; email_sent_at: string | null; order_number: string | null }[];
  const alertMails = () => sent.filter((m) => m.subject.includes("ALERT"));
  const settle = () => new Promise((r) => setTimeout(r, 1200));
  await pool.query("DELETE FROM ops_alerts");
  await pool.query("DELETE FROM rate_limits WHERE `key` LIKE 'stripe-bad-signature%'");

  const [p] = await db.select().from(products).where(eq(products.status, "active")).limit(1);
  const mkOrder = async (tag: string) => {
    const input = orderInputSchema.parse({
      customer: { name: "Webhook Bot", email: `${tag}@verify.test`, phone: "+971500000000" },
      emirate: "Dubai", address: { line1: "1 Test St" }, paymentMethod: "card",
      items: [{ productId: p.id, qty: p.min_order_qty }], locale: "en", acceptTerms: true, deliveryDate: testDeliveryDate(), deliverySlot: "morning",
    });
    const r = await placeOrder(input, new Map([[p.id, { qty: p.min_order_qty, vessel: false, months: 1 }]]), null, null, rules);
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

    // ---- alerts (PDF: payment-integrity failures must reach a human)
    await settle();
    let al = await alerts();
    const mismatch = al.filter((x) => x.kind === "payment_mismatch");
    assert.deepEqual(mismatch.map((x) => x.ref).sort(), [`${a.number}:${a.sessionId}`, `${a.number}:cs_test_someone_else`, "AF-NOPE:cs_x"].sort());
    assert(mismatch.some((x) => x.ref === `${a.number}:${a.sessionId}`));
    assert(mismatch.every((x) => x.email_sent_at));
    assert.equal(mismatch.find((x) => x.ref === `${a.number}:${a.sessionId}`)!.occurrences, 2);
    ok("mismatches raise one alert per (order, session): the order's own session (amount + currency = 2 occurrences), a foreign session, and an unknown order number");
    assert.equal(alertMails().filter((m) => /doesn.t match order|unknown order/.test(m.subject)).length, 3);
    ok("...and exactly one email per alert (to ALERT_EMAIL)");
    assert.equal(alertMails()[0].to, "ops@verify.test");

    // same problem again -> counted, not re-emailed
    const mailsBefore = alertMails().length;
    assert.equal(await send(evt(`evt_amt2_${Date.now()}`, "checkout.session.completed", { id: a.sessionId, amount_total: 100, metadata: { order_number: a.number } })), 200);
    await settle();
    al = await alerts();
    const again = al.find((x) => x.kind === "payment_mismatch" && x.ref === `${a.number}:${a.sessionId}`)!;
    assert(again.occurrences >= 3 && alertMails().length === mailsBefore);
    ok("a repeat of the same mismatch increments the counter without another email");

    // payment for a closed order
    const c = await mkOrder("c");
    await transitionOrder({ id: c.id }, "cancelled", "system", "verify");
    assert.equal(await send(evt(`evt_closed_${Date.now()}`, "checkout.session.completed", { id: c.sessionId, amount_total: Math.round(c.total * 100), metadata: { order_number: c.number } })), 200);
    await settle();
    al = await alerts();
    assert(al.some((x) => x.kind === "payment_closed_order" && x.ref === c.number && x.order_number === c.number));
    assert(alertMails().some((m) => m.subject.includes("closed order")));
    ok("customer paid for a cancelled order -> critical alert + email");

    // handler failure: block the next invoice number so markOrderPaid's transaction throws
    const d = await mkOrder("d");
    const fy = financialYear();
    const next = ((await counterSnapshot(pool, fy)) ?? 0) + 1;
    const blocker = await mkOrder("blocker");
    await pool.query("INSERT INTO invoices (id, order_id, number, fy, seq, seller, buyer, subtotal, vat, total) VALUES (UUID(), ?, 'BLOCKER', ?, ?, '{}', '{}', 0, 0, 0)", [blocker.id, fy, next]);
    const failId = `evt_fail_${Date.now()}`;
    const failEvt = evt(failId, "checkout.session.completed", { id: d.sessionId, amount_total: Math.round(d.total * 100), metadata: { order_number: d.number } });
    assert.equal(await send(failEvt), 500);
    await settle();
    al = await alerts();
    assert(al.some((x) => x.kind === "webhook_failed" && x.ref === failId && !x.resolved_at));
    assert.equal((await get(d.id)).payment_status, "unpaid", "failed handler must roll the whole payment back");
    assert(alertMails().some((m) => m.subject.includes("webhook failed")));
    ok("handler failure -> HTTP 500 (Stripe will retry), payment rolled back, alert + email");
    // clear the cause; Stripe's retry of the SAME event now succeeds and clears the alert by itself
    const conn = await pool.getConnection();
    await conn.query("SET @allow_invoice_delete = 1");
    await conn.query("DELETE FROM invoices WHERE number = 'BLOCKER'");
    conn.release();
    assert.equal(await send(failEvt), 200);
    assert.equal((await get(d.id)).payment_status, "paid");
    al = await alerts();
    assert(al.find((x) => x.ref === failId)!.resolved_at);
    ok("Stripe's retry succeeds -> order paid and the failure alert resolves itself");

    // bad signature burst
    for (let i = 0; i < 7; i++) await send(evt(`evt_sig${i}_${Date.now()}`, "checkout.session.completed", {}), { secret: "whsec_wrong" });
    await settle();
    al = await alerts();
    assert(al.some((x) => x.kind === "webhook_bad_signature"));
    assert.equal(alertMails().filter((m) => m.subject.includes("invalid signatures")).length, 1);
    ok("burst of invalid signatures -> a single alert email");

    // resolve + re-raise reopens and emails again; concurrent raisers email once
    const { raiseAlert } = await import("../src/lib/ops/alerts");
    const probe = { kind: "stripe_session_failed" as const, ref: "verify-probe", title: "Customers can't start card payments (probe)" };
    const m0 = alertMails().length;
    await Promise.all([raiseAlert(probe), raiseAlert(probe), raiseAlert(probe)]);
    await settle();
    assert.equal(alertMails().length - m0, 1);
    ok("3 simultaneous raisers of one alert -> 1 email");
    await pool.query("UPDATE ops_alerts SET resolved_at = UTC_TIMESTAMP(3) WHERE ref = 'verify-probe'");
    await raiseAlert(probe);
    await settle();
    assert.equal(alertMails().length - m0, 2);
    assert(!(await alerts()).find((x) => x.ref === "verify-probe")!.resolved_at);
    ok("a resolved alert that happens again reopens and emails again");

  } finally {
    mock.close();
    await pool.query("DELETE FROM ops_alerts");
    await cleanupVerifyData(pool, fyNow, counterBefore);
    await pool.query("DELETE FROM stripe_events WHERE id LIKE 'evt_%'");
    await pool.end();
  }
  console.log(out.join("\n"));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
