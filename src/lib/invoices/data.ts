import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, order_items, orders } from "@/lib/db/schema";

export interface InvoiceView {
  number: string;
  issued_at: string;
  currency: string;
  seller: (typeof invoices.$inferSelect)["seller"];
  buyer: (typeof invoices.$inferSelect)["buyer"];
  subtotal: number;
  vat: number;
  deposit_total: number;
  delivery_fee: number;
  delivery_vat: number;
  discount_total: number;
  coupon_code: string | null;
  total: number;
  order: { number: string; public_token: string; created_at: string; payment_method: string; delivery_date: string | null };
  lines: {
    name: string;
    name_ar: string | null;
    qty: number;
    unit_price: number;
    line_total: number;
    discount: number;
    vat_rate: number;
    vat: number;
    vessel: boolean;
    vessel_fee: number;
    rental_months: number | null;
  }[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(where: ReturnType<typeof eq>): Promise<InvoiceView | null> {
  const rows = await db
    .select({
      invoice: invoices,
      order_id: orders.id,
      order_number: orders.number,
      public_token: orders.public_token,
      created_at: orders.created_at,
      payment_method: orders.payment_method,
      delivery_date: orders.delivery_date,
    })
    .from(invoices)
    .innerJoin(orders, eq(invoices.order_id, orders.id))
    .where(where)
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  const lines = await db
    .select({
      name: order_items.name,
      name_ar: order_items.name_ar,
      qty: order_items.qty,
      unit_price: order_items.unit_price,
      line_total: order_items.line_total,
      discount: order_items.discount,
      vat_rate: order_items.vat_rate,
      vat: order_items.vat,
      vessel: order_items.vessel,
      vessel_fee: order_items.vessel_fee,
      rental_months: order_items.rental_months,
    })
    .from(order_items)
    .where(eq(order_items.order_id, r.order_id))
    .orderBy(asc(order_items.id));
  const { invoice } = r;
  return {
    number: invoice.number,
    issued_at: invoice.issued_at,
    currency: invoice.currency,
    seller: invoice.seller,
    buyer: invoice.buyer,
    subtotal: invoice.subtotal,
    vat: invoice.vat,
    deposit_total: invoice.deposit_total,
    delivery_fee: invoice.delivery_fee,
    delivery_vat: invoice.delivery_vat,
    discount_total: invoice.discount_total,
    coupon_code: invoice.coupon_code,
    total: invoice.total,
    order: {
      number: r.order_number,
      public_token: r.public_token,
      created_at: r.created_at,
      payment_method: r.payment_method,
      delivery_date: r.delivery_date,
    },
    lines,
  };
}

/** The order's secret token is the bearer credential (same as the confirmation page). */
export async function getInvoiceByToken(token: string): Promise<InvoiceView | null> {
  if (!UUID.test(token)) return null;
  return load(eq(orders.public_token, token));
}

export async function getInvoiceByOrderNumber(number: string): Promise<InvoiceView | null> {
  return load(eq(orders.number, number));
}
