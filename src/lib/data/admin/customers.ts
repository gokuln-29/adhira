import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, email, phone, company, type, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AdminCustomerRow[];
}
