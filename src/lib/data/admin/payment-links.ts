import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_links")
    .select(
      "id, amount, description, status, url, expires_at, paid_at, created_at, customers(name, phone)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PaymentLinkRow[];
}
