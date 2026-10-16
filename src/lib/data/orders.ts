import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { order_items, orders } from "@/lib/db/schema";

export interface OrderConfirmation {
  number: string;
  status: string;
  payment_method: string;
  payment_status: string;
  subtotal: number;
  vat: number;
  delivery_fee: number;
  deposit_total: number;
  total: number;
  currency: string;
  emirate: string | null;
  delivery_date: string | null;
  created_at: string;
  order_items: { name: string; qty: number; unit_price: number; line_total: number }[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Reads by `orders.public_token` (a random UUID that only the buyer's browser
// and Stripe redirect ever see), not by the human-readable order number —
// numbers are shareable and must never unlock an order page. Backs the
// guest-checkout confirmation page. Server Component use only.
export async function getOrderByToken(token: string): Promise<OrderConfirmation | null> {
  if (!UUID.test(token)) return null;
  const rows = await db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      payment_method: orders.payment_method,
      payment_status: orders.payment_status,
      subtotal: orders.subtotal,
      vat: orders.vat,
      delivery_fee: orders.delivery_fee,
      deposit_total: orders.deposit_total,
      total: orders.total,
      currency: orders.currency,
      emirate: orders.emirate,
      delivery_date: orders.delivery_date,
      created_at: orders.created_at,
    })
    .from(orders)
    .where(eq(orders.public_token, token))
    .limit(1);
  const order = rows[0];
  if (!order) return null;
  const { id, ...rest } = order;
  const items = await db
    .select({
      name: order_items.name,
      qty: order_items.qty,
      unit_price: order_items.unit_price,
      line_total: order_items.line_total,
    })
    .from(order_items)
    .where(eq(order_items.order_id, id));
  return { ...rest, order_items: items };
}
