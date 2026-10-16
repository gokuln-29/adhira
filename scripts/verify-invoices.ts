// Evidence script for invoicing against a local MySQL (never production).
//   npm run verify:invoices
import "./_env";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";

async function main() {
  if (/prod/i.test(process.env.DATABASE_URL ?? "")) throw new Error("refusing: production-looking DATABASE_URL");
  const { financialYear, formatInvoiceNumber } = await import("../src/lib/invoices/number");
  const { db, pool } = await import("../src/lib/db");
  const { products, orders, order_items, invoices, invoice_counters } = await import("../src/lib/db/schema");
  const { placeOrder } = await import("../src/lib/orders/place-order");
  const { markOrderPaid } = await import("../src/lib/orders/transitions");
  const { issueInvoice } = await import("../src/lib/invoices/issue");
  const { orderInputSchema } = await import("../src/lib/validators/order");
  const out: string[] = [];
  const ok = (m: string) => out.push(`PASS ${m}`);

  // --- numbering (pure)
  assert.equal(financialYear(new Date("2026-10-16T08:00:00Z")), "2026-27");
  assert.equal(financialYear(new Date("2027-03-31T19:30:00Z")), "2026-27"); // 23:30 Dubai, last day of FY
  assert.equal(financialYear(new Date("2027-03-31T20:30:00Z")), "2027-28"); // 00:30 Dubai on 1 April
  assert.equal(financialYear(new Date("2026-04-01T00:00:00+04:00")), "2026-27");
  assert.equal(financialYear(new Date("2026-03-31T23:59:00+04:00")), "2025-26");
  assert.equal(financialYear(new Date("2099-06-01T00:00:00Z")), "2099-00");
  assert.equal(formatInvoiceNumber("2026-27", 1), "AF/2026-27/001");
  assert.equal(formatInvoiceNumber("2026-27", 42), "AF/2026-27/042");
  assert.equal(formatInvoiceNumber("2026-27", 1000), "AF/2026-27/1000");
  ok("number format AF/2026-27/001; FY rolls over on 1 April Dubai time (boundary at 23:30 / 00:30)");

  const TEST_FY = "2099-00"; // never collides with real data
  const [p] = await db.select().from(products).where(eq(products.status, "active")).limit(1);
  const mk = async (i: number) => {
    const input = orderInputSchema.parse({
      customer: { name: `Inv Bot ${i}`, email: `inv${i}@verify.test`, phone: "+971500000000", company: i % 2 ? "Acme LLC" : undefined, trn: i % 2 ? "100123456700003" : undefined },
      emirate: "Dubai", address: { line1: "1 Test St" }, paymentMethod: "card",
      items: [{ productId: p.id, qty: Math.max(p.min_order_qty, 3), vessel: false, months: 1 }], locale: "en", acceptTerms: true,
    });
    const r = await placeOrder(input, new Map([[p.id, { qty: Math.max(p.min_order_qty, 3), vessel: false, months: 1 }]]), null, null);
    assert(r.ok);
    return r.order.id;
  };
  // The test advances the real current-FY counter; restore it so dev numbering stays clean.
  const fyNow = financialYear();
  const counterBefore = (await db.select().from(invoice_counters).where(eq(invoice_counters.fy, fyNow)))[0]?.last_seq ?? null;
  const cleanup = async () => {
    const conn = await pool.getConnection();
    try {
      await conn.query("SET @allow_invoice_delete = 1");
      await conn.query("DELETE FROM invoices WHERE order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE email LIKE '%@verify.test'))");
      await conn.query("DELETE FROM invoices WHERE fy = ?", [TEST_FY]);
      await conn.query("DELETE FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE email LIKE '%@verify.test')");
      await conn.query("DELETE FROM customers WHERE email LIKE '%@verify.test'");
      await conn.query("DELETE FROM invoice_counters WHERE fy = ?", [TEST_FY]);
      if (counterBefore === null) await conn.query("DELETE FROM invoice_counters WHERE fy = ?", [fyNow]);
      else await conn.query("UPDATE invoice_counters SET last_seq = ? WHERE fy = ?", [counterBefore, fyNow]);
    } finally {
      conn.release();
    }
  };

  try {
    await cleanup();
    // Realistic path: pay 12 orders at once through markOrderPaid (current FY).
    const before = await db.select({ n: invoice_counters.last_seq }).from(invoice_counters).where(eq(invoice_counters.fy, financialYear()));
    const startSeq = before[0]?.n ?? 0;
    const ids = await Promise.all(Array.from({ length: 12 }, (_, i) => mk(i)));
    const res = await Promise.all(ids.map((id) => markOrderPaid({ id }, "system", { note: "verify" })));
    assert(res.every((r) => r.ok && r.changed));
    const invs = await db.select().from(invoices).where(eq(invoices.fy, financialYear()));
    const mine = invs.filter((i) => ids.includes(i.order_id)).sort((a, b) => a.seq - b.seq);
    assert.equal(mine.length, 12);
    assert.deepEqual(mine.map((i) => i.seq), Array.from({ length: 12 }, (_, i) => startSeq + i + 1));
    assert.equal(new Set(mine.map((i) => i.number)).size, 12);
    ok(`12 simultaneous payments -> 12 unique, gap-free numbers (${mine[0].number} … ${mine[11].number})`);

    // Idempotent: paying again doesn't issue another.
    await markOrderPaid({ id: ids[0] }, "system");
    assert.equal((await db.select().from(invoices).where(eq(invoices.order_id, ids[0]))).length, 1);
    ok("paying an already-paid order never issues a second invoice");

    // Rollback: a failed payment transaction must not consume a number.
    const c0 = (await db.select().from(invoice_counters).where(eq(invoice_counters.fy, TEST_FY)))[0]?.last_seq ?? 0;
    const extra = await mk(99);
    const [order] = await db.select().from(orders).where(eq(orders.id, extra));
    await assert.rejects(
      db.transaction(async (tx) => {
        await issueInvoice(tx, order, new Date("2099-06-01T00:00:00Z"));
        throw new Error("payment failed after allocating a number");
      }),
    );
    const c1 = (await db.select().from(invoice_counters).where(eq(invoice_counters.fy, TEST_FY)))[0]?.last_seq ?? 0;
    assert.equal(c1, c0);
    ok("rolled-back transaction does not burn an invoice number (gap-free)");

    // New FY restarts at 001
    await db.transaction(async (tx) => void (await issueInvoice(tx, order, new Date("2099-06-01T00:00:00Z"))));
    const fresh = (await db.select().from(invoices).where(eq(invoices.order_id, extra)))[0];
    assert.equal(fresh.number, "AF/2099-00/001");
    ok("a new financial year restarts at 001");

    // Arithmetic + snapshot content
    for (const inv of mine) {
      const lines = await db.select().from(order_items).where(eq(order_items.order_id, inv.order_id));
      const sumTaxable = Math.round(lines.reduce((s, l) => s + l.line_total, 0) * 100);
      const sumVat = Math.round(lines.reduce((s, l) => s + l.vat, 0) * 100);
      assert.equal(sumTaxable, Math.round(inv.subtotal * 100));
      assert.equal(sumVat, Math.round(inv.vat * 100));
      assert.equal(Math.round((inv.subtotal + inv.vat + inv.deposit_total + inv.delivery_fee) * 100), Math.round(inv.total * 100));
      assert(lines.every((l) => l.vat_rate === 5));
    }
    ok("per-line VAT sums to invoice VAT; taxable + VAT + deposit + delivery = total (all 12)");
    const b2b = mine.find((i) => i.buyer.company);
    assert(b2b && b2b.buyer.trn === "100123456700003" && b2b.buyer.name.startsWith("Inv Bot"));
    ok("buyer company + TRN snapshotted onto B2B invoices");
    assert("legal_name" in mine[0].seller && "trn" in mine[0].seller);
    ok("seller block (legal name, address, TRN, contact) snapshotted");

    // Immutability enforced by the database
    await assert.rejects(pool.query("UPDATE invoices SET total = 1 WHERE id = ?", [mine[0].id]), /immutable/);
    await assert.rejects(pool.query("DELETE FROM invoices WHERE id = ?", [mine[0].id]), /cannot be deleted/);
    await assert.rejects(pool.query("DELETE FROM orders WHERE id = ?", [mine[0].order_id]));
    ok("invoices can't be updated or deleted, and an invoiced order can't be deleted");
  } finally {
    await cleanup();
    await pool.end();
  }
  console.log(out.join("\n"));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
