import { and, asc, count, eq, inArray, lt, sum } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, leads, orders } from "@/lib/db/schema";
import { OPEN_STATUSES } from "@/lib/constants/order";

const OPEN = [...OPEN_STATUSES];

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
  const dubai = (offsetDays: number) =>
    new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });
  const today = dubai(0);
  const tomorrow = dubai(1);

  const [deliveringToday, tomorrowQ, overdue, needsAction, deposits, newLeads] = await Promise.all([
    db
      .select({
        number: orders.number,
        status: orders.status,
        emirate: orders.emirate,
        delivery_date: orders.delivery_date,
        total: orders.total,
        customer_name: customers.name,
      })
      .from(orders)
      .leftJoin(customers, eq(orders.customer_id, customers.id))
      .where(and(eq(orders.delivery_date, today), inArray(orders.status, OPEN)))
      .orderBy(asc(orders.created_at))
      .limit(30),
    db.select({ n: count() }).from(orders).where(and(eq(orders.delivery_date, tomorrow), inArray(orders.status, OPEN))),
    db.select({ n: count() }).from(orders).where(and(lt(orders.delivery_date, today), inArray(orders.status, OPEN))),
    db.select({ n: count() }).from(orders).where(inArray(orders.status, ["pending", "confirmed"])),
    db
      .select({ n: count(), total: sum(orders.deposit_total) })
      .from(orders)
      .where(eq(orders.deposit_status, "held")),
    db.select({ n: count() }).from(leads).where(eq(leads.stage, "new")),
  ]);

  return {
    today,
    deliveringToday: deliveringToday.map(({ customer_name, ...o }) => ({
      ...o,
      customers: customer_name == null ? null : { name: customer_name },
    })),
    tomorrowCount: tomorrowQ[0]?.n ?? 0,
    overdueCount: overdue[0]?.n ?? 0,
    needsActionCount: needsAction[0]?.n ?? 0,
    depositsHeldCount: deposits[0]?.n ?? 0,
    depositsHeldTotal: Number(deposits[0]?.total ?? 0),
    newLeadsCount: newLeads[0]?.n ?? 0,
  };
}
