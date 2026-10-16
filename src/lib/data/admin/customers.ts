import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";

export interface AdminCustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  type: "retail" | "corporate";
  created_at: string;
}

export async function getAllCustomersAdmin(): Promise<AdminCustomerRow[]> {
  return db
    .select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      phone: customers.phone,
      company: customers.company,
      type: customers.type,
      created_at: customers.created_at,
    })
    .from(customers)
    .orderBy(desc(customers.created_at));
}
