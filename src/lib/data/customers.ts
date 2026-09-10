import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentCustomer(): Promise<CustomerProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("customers")
    .select("id, name, email, phone, company, trn, type")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as CustomerProfile | null;
}

export async function getOrdersForCustomer(customerId: string): Promise<CustomerOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, number, status, total, currency, delivery_date, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as CustomerOrder[];
}
