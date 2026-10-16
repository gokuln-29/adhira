import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, payment_links } from "@/lib/db/schema";

export interface PaymentLinkRow {
  id: string;
  amount: number;
  description: string | null;
  status: "pending" | "paid" | "expired";
  url: string | null;
  expires_at: string | null;
  paid_at: string | null;
  created_at: string;
  customers: { name: string; phone: string | null } | null;
}

export async function getAllPaymentLinksAdmin(): Promise<PaymentLinkRow[]> {
  const rows = await db
    .select({
      id: payment_links.id,
      amount: payment_links.amount,
      description: payment_links.description,
      status: payment_links.status,
      url: payment_links.url,
      expires_at: payment_links.expires_at,
      paid_at: payment_links.paid_at,
      created_at: payment_links.created_at,
      customer_name: customers.name,
      customer_phone: customers.phone,
    })
    .from(payment_links)
    .leftJoin(customers, eq(payment_links.customer_id, customers.id))
    .orderBy(desc(payment_links.created_at));
  return rows.map(({ customer_name, customer_phone, ...r }) => ({
    ...r,
    customers: customer_name == null ? null : { name: customer_name, phone: customer_phone },
  }));
}
