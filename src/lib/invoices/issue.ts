import "server-only";
import { eq, sql } from "drizzle-orm";
import type { Tx } from "@/lib/db";
import { customers, invoice_counters, invoices, orders, store_settings } from "@/lib/db/schema";
import { newId } from "@/lib/db/helpers";
import { financialYear, formatInvoiceNumber } from "@/lib/invoices/number";

type OrderRow = typeof orders.$inferSelect;

/**
 * Issues the tax invoice for an order. Must run inside the transaction that
 * records the payment (order row already locked by the caller), so the number is
 * allocated atomically: if the payment rolls back, so does the number, which is
 * what keeps the sequence gap-free. Idempotent per order.
 */
export async function issueInvoice(tx: Tx, order: OrderRow, at: Date = new Date()): Promise<string> {
  const existing = await tx.select({ number: invoices.number }).from(invoices).where(eq(invoices.order_id, order.id)).limit(1);
  if (existing[0]) return existing[0].number;

  const fy = financialYear(at);
  // Row lock on the year's counter serialises concurrent issuers.
  await tx
    .insert(invoice_counters)
    .values({ fy, last_seq: 1 })
    .onDuplicateKeyUpdate({ set: { last_seq: sql`${invoice_counters.last_seq} + 1` } });
  const counter = await tx.select({ seq: invoice_counters.last_seq }).from(invoice_counters).where(eq(invoice_counters.fy, fy)).limit(1).for("update");
  const seq = counter[0]!.seq;
  const number = formatInvoiceNumber(fy, seq);

  const [settings] = await tx.select().from(store_settings).where(eq(store_settings.id, 1)).limit(1);
  const [customer] = order.customer_id
    ? await tx.select().from(customers).where(eq(customers.id, order.customer_id)).limit(1)
    : [];

  await tx.insert(invoices).values({
    id: newId(),
    order_id: order.id,
    number,
    fy,
    seq,
    issued_at: at.toISOString(),
    seller: {
      legal_name: settings?.legal_name ?? null,
      legal_name_ar: settings?.legal_name_ar ?? null,
      address: settings?.address ?? null,
      address_ar: settings?.address_ar ?? null,
      trn: settings?.trn ?? null,
      phone: settings?.contact_phone ?? null,
      email: settings?.contact_email ?? null,
    },
    buyer: {
      name: customer?.name ?? "",
      company: customer?.company ?? null,
      trn: customer?.trn ?? null,
      email: customer?.email ?? "",
      phone: customer?.phone ?? null,
      emirate: order.emirate,
      address: order.address,
    },
    subtotal: order.subtotal,
    vat: order.vat,
    deposit_total: order.deposit_total,
    delivery_fee: order.delivery_fee,
    total: order.total,
    currency: order.currency,
  });
  return number;
}
