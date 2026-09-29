import { createClient } from "@/lib/supabase/server";

const OPEN = ["pending", "paid", "processing", "out_for_delivery"];

export interface TodayOrder {
  number: string;
  status: string;
  emirate: string | null;
  delivery_date: string | null;
  total: number;
  customers: { name: string } | null;
}

export interface TodayData {
  today: string;
  deliveringToday: TodayOrder[];
  tomorrowCount: number;
  overdueCount: number;
  needsActionCount: number;
  depositsHeldCount: number;
  depositsHeldTotal: number;
  newLeadsCount: number;
}

// "What do I need to do today?" — a handful of cheap indexed queries instead
// of loading every order.
export async function getTodayData(): Promise<TodayData> {
  const supabase = await createClient();
  const dubai = (offsetDays: number) =>
    new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });
  const today = dubai(0);
  const tomorrow = dubai(1);

  const [deliveringToday, tomorrowQ, overdue, needsAction, deposits, leads] = await Promise.all([
    supabase
      .from("orders")
      .select("number, status, emirate, delivery_date, total, customers(name)")
      .eq("delivery_date", today)
      .in("status", OPEN)
      .order("created_at", { ascending: true })
      .limit(30),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("delivery_date", tomorrow)
      .in("status", OPEN),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .lt("delivery_date", today)
      .in("status", OPEN),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "paid"]),
    supabase.from("orders").select("deposit_total").eq("deposit_status", "held"),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("stage", "new"),
  ]);

  for (const r of [deliveringToday, tomorrowQ, overdue, needsAction, deposits, leads]) {
    if (r.error) throw r.error;
  }

  const held = (deposits.data ?? []) as { deposit_total: number }[];
  return {
    today,
    deliveringToday: (deliveringToday.data ?? []) as unknown as TodayOrder[],
    tomorrowCount: tomorrowQ.count ?? 0,
    overdueCount: overdue.count ?? 0,
    needsActionCount: needsAction.count ?? 0,
    depositsHeldCount: held.length,
    depositsHeldTotal: held.reduce((sum, r) => sum + Number(r.deposit_total), 0),
    newLeadsCount: leads.count ?? 0,
  };
}
