import { createClient } from "@/lib/supabase/server";

export interface AdminUser {
  id: string;
  name: string;
  role: "owner" | "admin" | "staff";
}

export async function getCurrentAdmin(): Promise<AdminUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("admin_users")
    .select("id, name, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as AdminUser | null;
}
