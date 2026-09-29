import { createClient } from "@/lib/supabase/server";

export interface StaffRow {
  id: string;
  name: string;
  role: "owner" | "manager" | "staff";
  created_at: string;
}

export async function getAllStaff(): Promise<StaffRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_users")
    .select("id, name, role, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as StaffRow[];
}
