import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, type Tx } from "@/lib/db";
import { order_items, order_status_events, orders, products } from "@/lib/db/schema";
import { newId } from "@/lib/db/helpers";
import { canTransition, type OrderStatus } from "@/lib/constants/order";

// The one place order status / payment status / deposit status change. Every
// change locks the order row, validates against the state machine and appends
// an immutable row to order_status_events (who, what, when).

export type Actor = `admin:${string}` | "stripe" | "system" | "customer";

export type TransitionResult = { ok: true; changed: boolean } | { ok: false; error: string };

async function log(
  tx: Tx,
  orderId: string,
  kind: "status" | "payment" | "deposit",
  from: string | null,
  to: string,
  actor: Actor,
  note?: string,
) {
  await tx.insert(order_status_events).values({
    id: newId(),
    order_id: orderId,
    kind,
    from_value: from,
    to_value: to,
    actor,
    note: note?.slice(0, 500) ?? null,
  });
}

async function lockOrder(tx: Tx, where: { number: string } | { id: string }) {
  const rows = await tx
    .select()
    .from(orders)
    .where("number" in where ? eq(orders.number, where.number) : eq(orders.id, where.id))
    .limit(1)
    .for("update");
  return rows[0] ?? null;
}

async function restock(tx: Tx, orderId: string) {
  const items = await tx
    .select({ product_id: order_items.product_id, qty: order_items.qty })
    .from(order_items)
    .where(eq(order_items.order_id, orderId));
  for (const it of items) {
    if (!it.product_id) continue;
    // NULL stock_qty means "not tracked": NULL + n stays NULL.
    await tx
      .update(products)
      .set({ stock_qty: sql`${products.stock_qty} + ${it.qty}` })
      .where(eq(products.id, it.product_id));
  }
}

export async function transitionOrder(
  where: { number: string } | { id: string },
  to: OrderStatus,
  actor: Actor,
  note?: string,
): Promise<TransitionResult> {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, where);
    if (!order) return { ok: false, error: "Order not found." } as const;
    if (order.status === to) return { ok: true, changed: false } as const;
    if (!canTransition(order.status, to)) {
      return { ok: false, error: `An order that is ${order.status} can't move to ${to}.` } as const;
    }

    const patch: Partial<typeof orders.$inferInsert> = { status: to };
    if (to === "refunded" && order.payment_status === "paid") patch.payment_status = "refunded";
    await tx.update(orders).set(patch).where(eq(orders.id, order.id));
    await log(tx, order.id, "status", order.status, to, actor, note);
    if (patch.payment_status) await log(tx, order.id, "payment", order.payment_status, patch.payment_status, actor, note);

    if (to === "cancelled") await restock(tx, order.id);
    return { ok: true, changed: true } as const;
  });
}

/**
 * Records a verified payment. Only the Stripe webhook (signature-checked, amount
 * and currency matched) or an admin confirming cash received may call this.
 * Idempotent: a repeat call for an already-paid order changes nothing.
 */
export async function markOrderPaid(
  where: { number: string } | { id: string },
  actor: Actor,
  details: { paymentIntentId?: string | null; note?: string } = {},
): Promise<TransitionResult> {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, where);
    if (!order) return { ok: false, error: "Order not found." } as const;
    if (order.payment_status === "paid") return { ok: true, changed: false } as const;
    if (order.status === "cancelled" || order.status === "refunded") {
      // Money arrived for an order we'd already closed: leave it for a human.
      return { ok: false, error: `Order is ${order.status}; payment needs manual review.` } as const;
    }

    await tx
      .update(orders)
      .set({
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        ...(details.paymentIntentId ? { stripe_payment_intent_id: details.paymentIntentId } : {}),
        // Online payment confirms the order; COD stays where staff put it.
        ...(order.status === "pending" && order.payment_method !== "cod" ? { status: "confirmed" as const } : {}),
      })
      .where(eq(orders.id, order.id));
    await log(tx, order.id, "payment", order.payment_status, "paid", actor, details.note);
    if (order.status === "pending" && order.payment_method !== "cod") {
      await log(tx, order.id, "status", "pending", "confirmed", actor, "payment received");
    }
    return { ok: true, changed: true } as const;
  });
}

export async function setDepositStatus(
  number: string,
  to: "held" | "refunded",
  actor: Actor,
): Promise<TransitionResult> {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, { number });
    if (!order || order.deposit_total <= 0) return { ok: false, error: "This order has no deposit." } as const;
    if (order.deposit_status === to) return { ok: true, changed: false } as const;
    await tx.update(orders).set({ deposit_status: to }).where(eq(orders.id, order.id));
    await log(tx, order.id, "deposit", order.deposit_status, to, actor);
    return { ok: true, changed: true } as const;
  });
}
