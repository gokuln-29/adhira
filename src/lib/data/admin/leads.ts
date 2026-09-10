import { createClient } from "@/lib/supabase/server";

export interface LeadRow {
  id: string;
  company: string | null;
  contact: string;
  email: string | null;
  phone: string | null;
  requirement: string | null;
  frequency: string | null;
  emirate: string | null;
  budget: string | null;
  message: string | null;
  stage: "new" | "contacted" | "quoted" | "won" | "lost";
  created_at: string;
}

export async function getAllLeadsAdmin(): Promise<LeadRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select(
      "id, company, contact, email, phone, requirement, frequency, emirate, budget, message, stage, created_at",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as LeadRow[];
}
