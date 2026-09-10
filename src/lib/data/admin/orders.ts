import { createClient } from "@/lib/supabase/server";

export interface AdminOrderListRow {
  number: string;
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
  order_items: { name: string; qty: number; unit_price: number; line_total: number }[];
}

const LIST_SELECT =
  "number, status, total, channel, emirate, created_at, customers(name, email)";
const DETAIL_SELECT =
  "number, status, total, subtotal, vat, delivery_fee, currency, channel, emirate, address, delivery_date, notes, created_at, customers(name, email), order_items(name, qty, unit_price, line_total)";

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
