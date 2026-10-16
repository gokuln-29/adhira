import { and, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, order_items, order_status_events, orders } from "@/lib/db/schema";

export interface AdminOrderListRow {
  number: string;
  delivery_date: string | null;
  deposit_status: string;
  status: string;
  payment_status: string;
  total: number;
  channel: string;
  emirate: string | null;
  created_at: string;
  customers: { name: string; email: string } | null;
}

export interface AdminOrderDetail extends AdminOrderListRow {
  subtotal: number;
  vat: number;
  delivery_fee: number;
  currency: string;
  payment_method: string;
  address: Record<string, unknown>;
  delivery_date: string | null;
  notes: string | null;
  deposit_total: number;
  deposit_status: "none" | "held" | "refunded";
  order_items: {
    name: string;
    qty: number;
    unit_price: number;
    line_total: number;
    vessel: boolean;
    vessel_fee: number;
    deposit: number;
    rental_months: number | null;
  }[];
  history: {
    kind: string;
    from_value: string | null;
    to_value: string;
    actor: string;
    note: string | null;
    created_at: string;
  }[];
}

const listColumns = {
  number: orders.number,
  status: orders.status,
  payment_status: orders.payment_status,
  total: orders.total,
  channel: orders.channel,
  emirate: orders.emirate,
  delivery_date: orders.delivery_date,
  deposit_status: orders.deposit_status,
  created_at: orders.created_at,
  customer_name: customers.name,
  customer_email: customers.email,
};

function shapeList<T extends { customer_name: string | null; customer_email: string | null }>(
  r: T,
): Omit<T, "customer_name" | "customer_email"> & { customers: { name: string; email: string } | null } {
  const { customer_name, customer_email, ...rest } = r;
  return { ...rest, customers: customer_name == null ? null : { name: customer_name, email: customer_email ?? "" } };
}

export async function getAllOrdersAdmin(): Promise<AdminOrderListRow[]> {
  const rows = await db
    .select(listColumns)
    .from(orders)
    .leftJoin(customers, eq(orders.customer_id, customers.id))
    .orderBy(desc(orders.created_at));
  return rows.map(shapeList);
}

export async function getOrderByNumberAdmin(number: string): Promise<AdminOrderDetail | null> {
  const rows = await db
    .select({
      ...listColumns,
      id: orders.id,
      subtotal: orders.subtotal,
      vat: orders.vat,
      delivery_fee: orders.delivery_fee,
      currency: orders.currency,
      payment_method: orders.payment_method,
      address: orders.address,
      notes: orders.notes,
      deposit_total: orders.deposit_total,
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customer_id, customers.id))
    .where(eq(orders.number, number))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const { id, ...rest } = row;

  const [items, history] = await Promise.all([
    db
      .select({
        name: order_items.name,
        qty: order_items.qty,
        unit_price: order_items.unit_price,
        line_total: order_items.line_total,
        vessel: order_items.vessel,
        vessel_fee: order_items.vessel_fee,
        deposit: order_items.deposit,
        rental_months: order_items.rental_months,
      })
      .from(order_items)
      .where(eq(order_items.order_id, id)),
    db
      .select({
        kind: order_status_events.kind,
        from_value: order_status_events.from_value,
        to_value: order_status_events.to_value,
        actor: order_status_events.actor,
        note: order_status_events.note,
        created_at: order_status_events.created_at,
      })
      .from(order_status_events)
      .where(eq(order_status_events.order_id, id))
      .orderBy(desc(order_status_events.created_at)),
  ]);

  return { ...shapeList(rest), order_items: items, history } as AdminOrderDetail;
}

export const ORDER_VIEWS = {
  all: null,
  action: ["pending", "confirmed"],
  progress: ["preparing", "dispatched"],
  delivered: ["delivered"],
  closed: ["cancelled", "refunded"],
} as const;
export type OrderView = keyof typeof ORDER_VIEWS;
export const ORDERS_PAGE_SIZE = 25;

export async function getOrdersPageAdmin(opts: {
  view: OrderView;
  page: number;
}): Promise<{ rows: AdminOrderListRow[]; total: number }> {
  const statuses = ORDER_VIEWS[opts.view];
  const where = statuses ? and(inArray(orders.status, [...statuses])) : undefined;
  const [rows, totals] = await Promise.all([
    db
      .select(listColumns)
      .from(orders)
      .leftJoin(customers, eq(orders.customer_id, customers.id))
      .where(where)
      .orderBy(desc(orders.created_at))
      .limit(ORDERS_PAGE_SIZE)
      .offset((opts.page - 1) * ORDERS_PAGE_SIZE),
    db.select({ n: count() }).from(orders).where(where),
  ]);
  return { rows: rows.map(shapeList), total: totals[0]?.n ?? 0 };
}
