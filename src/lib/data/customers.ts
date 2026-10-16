import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, orders } from "@/lib/db/schema";
import { readCustomerSession } from "@/lib/auth/customer-session";

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  trn: string | null;
  type: "retail" | "corporate";
}

export interface CustomerOrder {
  id: string;
  number: string;
  status: string;
  total: number;
  currency: string;
  delivery_date: string | null;
  created_at: string;
}

export async function getCurrentUser() {
  return readCustomerSession();
}

export async function getCurrentCustomer(): Promise<CustomerProfile | null> {
  const session = await readCustomerSession();
  if (!session) return null;
  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      phone: customers.phone,
      company: customers.company,
      trn: customers.trn,
      type: customers.type,
    })
    .from(customers)
    .where(eq(customers.id, session.id))
    .limit(1);
  return rows[0] ?? null;
}

// Callers pass the id of the signed-in customer (never a client-supplied one).
export async function getOrdersForCustomer(customerId: string): Promise<CustomerOrder[]> {
  return db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      total: orders.total,
      currency: orders.currency,
      delivery_date: orders.delivery_date,
      created_at: orders.created_at,
    })
    .from(orders)
    .where(eq(orders.customer_id, customerId))
    .orderBy(desc(orders.created_at));
}
