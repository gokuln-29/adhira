import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { roleCan, type AdminUser, type Permission } from "@/lib/admin/roles";

export { roleCan, ROLE_PERMISSIONS } from "@/lib/admin/roles";
export type { AdminRole, AdminUser, Permission } from "@/lib/admin/roles";

// `cache` dedupes the two Supabase round trips when the layout and a page (or
// several actions in one request) both ask who the admin is.
export const getCurrentAdmin = cache(async (): Promise<AdminUser | null> => {
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
});

export function can(admin: AdminUser | null, permission: Permission): boolean {
  return roleCan(admin?.role, permission);
}

// For pages/layouts: send people who can't use a section back to the dashboard.
export async function requirePermission(permission: Permission): Promise<AdminUser> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (!can(admin, permission)) redirect("/admin");
  return admin;
}

export type AuthResult =
  | { ok: true; admin: AdminUser }
  | { ok: false; error: string };

// Call FIRST in every admin server action: server actions are public POST
// endpoints, so nothing else (layouts, hidden buttons) protects them.
export async function authorize(permission: Permission): Promise<AuthResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, error: "Please sign in again." };
  if (!can(admin, permission)) {
    return { ok: false, error: "You don't have permission to do this." };
  }
  return { ok: true, admin };
}
