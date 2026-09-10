import { createClient } from "@/lib/supabase/server";

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

const COMMITTED_STATUSES = ["paid", "processing", "out_for_delivery", "delivered"];

export async function getDashboardData(days: number): Promise<DashboardData> {
  const supabase = await createClient();
  const now = new Date();
  const rangeStart = new Date(now.getTime() - days * 86400000);
  const prevStart = new Date(rangeStart.getTime() - days * 86400000);

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select(
      "id, number, status, total, channel, created_at, customers(name)",
    )
    .gte("created_at", prevStart.toISOString())
    .order("created_at", { ascending: false });
  if (ordersError) throw ordersError;

  const allOrders = (orders ?? []) as unknown as {
    id: string;
    number: string;
    status: string;
    total: number;
    channel: string;
    created_at: string;
    customers: { name: string } | null;
  }[];

  const current = allOrders.filter((o) => new Date(o.created_at) >= rangeStart);
  const previous = allOrders.filter(
    (o) => new Date(o.created_at) < rangeStart && new Date(o.created_at) >= prevStart,
  );

  const committed = (list: typeof allOrders) =>
    list.filter((o) => COMMITTED_STATUSES.includes(o.status));

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
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("line_total, order_id, products(categories(name))")
      .in("order_id", orderIds);
    if (itemsError) throw itemsError;

    const map = new Map<string, number>();
    for (const item of (items ?? []) as unknown as {
      line_total: number;
      products: { categories: { name: string } | null } | null;
    }[]) {
      const name = item.products?.categories?.name ?? "Uncategorized";
      map.set(name, (map.get(name) ?? 0) + item.line_total);
    }
    categorySplit = Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }

  const { data: links, error: linksError } = await supabase
    .from("payment_links")
    .select("amount")
    .eq("status", "pending");
  if (linksError) throw linksError;

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
    unpaidLinksCount: links?.length ?? 0,
    unpaidLinksTotal: (links ?? []).reduce((sum, l) => sum + (l.amount as number), 0),
  };
}
