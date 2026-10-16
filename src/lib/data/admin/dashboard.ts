import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, customers, order_items, orders, payment_links, products } from "@/lib/db/schema";
import { COMMITTED_STATUSES } from "@/lib/constants/order";

export interface DashboardData {
  revenue: number;
  revenuePrev: number;
  orderCount: number;
  orderCountPrev: number;
  aov: number;
  aovPrev: number;
  pendingCount: number;
  pendingTotal: number;
  revenueByDay: { date: string; revenue: number }[];
  categorySplit: { name: string; value: number }[];
  channelSplit: { retail: number; corporate: number };
  recentOrders: {
    number: string;
    customerName: string;
    total: number;
    status: string;
    created_at: string;
  }[];
  unpaidLinksCount: number;
  unpaidLinksTotal: number;
}

const COMMITTED: readonly string[] = COMMITTED_STATUSES;

export async function getDashboardData(days: number): Promise<DashboardData> {
  const now = new Date();
  const rangeStart = new Date(now.getTime() - days * 86400000);
  const prevStart = new Date(rangeStart.getTime() - days * 86400000);

  const rows = await db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      total: orders.total,
      channel: orders.channel,
      created_at: orders.created_at,
      customer_name: customers.name,
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customer_id, customers.id))
    .where(gte(orders.created_at, prevStart.toISOString()))
    .orderBy(desc(orders.created_at));

  const allOrders = rows.map(({ customer_name, ...o }) => ({
    ...o,
    customers: customer_name == null ? null : { name: customer_name },
  }));

  const current = allOrders.filter((o) => new Date(o.created_at) >= rangeStart);
  const previous = allOrders.filter(
    (o) => new Date(o.created_at) < rangeStart && new Date(o.created_at) >= prevStart,
  );

  const committed = (list: typeof allOrders) => list.filter((o) => COMMITTED.includes(o.status));

  const revenue = committed(current).reduce((sum, o) => sum + o.total, 0);
  const revenuePrev = committed(previous).reduce((sum, o) => sum + o.total, 0);
  const orderCount = committed(current).length;
  const orderCountPrev = committed(previous).length;
  const aov = orderCount ? revenue / orderCount : 0;
  const aovPrev = orderCountPrev ? revenuePrev / orderCountPrev : 0;

  const pendingOrders = current.filter((o) => o.status === "pending");
  const pendingCount = pendingOrders.length;
  const pendingTotal = pendingOrders.reduce((sum, o) => sum + o.total, 0);

  const revenueByDayMap = new Map<string, number>();
  for (const o of committed(current)) {
    const day = o.created_at.slice(0, 10);
    revenueByDayMap.set(day, (revenueByDayMap.get(day) ?? 0) + o.total);
  }
  const revenueByDay = Array.from(revenueByDayMap.entries())
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const channelSplit = {
    retail: committed(current)
      .filter((o) => o.channel === "retail")
      .reduce((sum, o) => sum + o.total, 0),
    corporate: committed(current)
      .filter((o) => o.channel === "corporate")
      .reduce((sum, o) => sum + o.total, 0),
  };

  const recentOrders = allOrders.slice(0, 8).map((o) => ({
    number: o.number,
    customerName: o.customers?.name ?? "—",
    total: o.total,
    status: o.status,
    created_at: o.created_at,
  }));

  const orderIds = committed(current).map((o) => o.id);
  let categorySplit: { name: string; value: number }[] = [];
  if (orderIds.length > 0) {
    const items = await db
      .select({ line_total: order_items.line_total, category: categories.name })
      .from(order_items)
      .leftJoin(products, eq(order_items.product_id, products.id))
      .leftJoin(categories, eq(products.category_id, categories.id))
      .where(inArray(order_items.order_id, orderIds));

    const map = new Map<string, number>();
    for (const item of items) {
      const name = item.category ?? "Uncategorized";
      map.set(name, (map.get(name) ?? 0) + item.line_total);
    }
    categorySplit = Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }

  const links = await db
    .select({ amount: payment_links.amount })
    .from(payment_links)
    .where(and(eq(payment_links.status, "pending")));

  return {
    revenue,
    revenuePrev,
    orderCount,
    orderCountPrev,
    aov,
    aovPrev,
    pendingCount,
    pendingTotal,
    revenueByDay,
    categorySplit,
    channelSplit,
    recentOrders,
    unpaidLinksCount: links.length,
    unpaidLinksTotal: links.reduce((sum, l) => sum + l.amount, 0),
  };
}
