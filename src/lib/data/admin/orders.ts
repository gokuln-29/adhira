import { createClient } from "@/lib/supabase/server";

export interface AdminOrderListRow {
  number: string;
  delivery_date: string | null;
  deposit_status: string;
  status: string;
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
}

const LIST_SELECT =
  "number, status, total, channel, emirate, delivery_date, deposit_status, created_at, customers(name, email)";
const DETAIL_SELECT =
  "number, status, total, subtotal, vat, delivery_fee, currency, channel, emirate, address, delivery_date, notes, deposit_total, deposit_status, created_at, customers(name, email), order_items(name, qty, unit_price, line_total, vessel, vessel_fee, deposit, rental_months)";

export async function getAllOrdersAdmin(): Promise<AdminOrderListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(LIST_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AdminOrderListRow[];
}

export async function getOrderByNumberAdmin(number: string): Promise<AdminOrderDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(DETAIL_SELECT)
    .eq("number", number)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as AdminOrderDetail | null;
}

export const ORDER_VIEWS = {
  all: null,
  action: ["pending", "paid"],
  progress: ["processing", "out_for_delivery"],
  delivered: ["delivered"],
  closed: ["cancelled", "refunded"],
} as const;
export type OrderView = keyof typeof ORDER_VIEWS;
export const ORDERS_PAGE_SIZE = 25;

export async function getOrdersPageAdmin(opts: {
  view: OrderView;
  page: number;
}): Promise<{ rows: AdminOrderListRow[]; total: number }> {
  const supabase = await createClient();
  const from = (opts.page - 1) * ORDERS_PAGE_SIZE;
  let query = supabase
    .from("orders")
    .select(LIST_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + ORDERS_PAGE_SIZE - 1);
  const statuses = ORDER_VIEWS[opts.view];
  if (statuses) query = query.in("status", [...statuses]);
  const { data, count, error } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as unknown as AdminOrderListRow[], total: count ?? 0 };
}
