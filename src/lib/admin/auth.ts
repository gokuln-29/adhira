import { redirect } from "next/navigation";
import { readAdminSession } from "@/lib/auth/admin-session";
import { assertSameOrigin } from "@/lib/auth/origin";
import { roleCan, type AdminUser, type Permission } from "@/lib/admin/roles";

export { roleCan, ROLE_PERMISSIONS } from "@/lib/admin/roles";
export type { AdminRole, AdminUser, Permission } from "@/lib/admin/roles";

// Only a fully authenticated session counts: password AND (if enrolled) MFA.
export async function getCurrentAdmin(): Promise<AdminUser | null> {
  const s = await readAdminSession();
  if (!s || !s.mfaPassed) return null;
  const { id, name, role } = s.admin;
  return { id, name, role };
}

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

// Call FIRST in every admin server action and mutating route handler: server
// actions are public POST endpoints, so nothing else (layouts, hidden buttons)
// protects them. There is no database-level RLS: this plus the least-privilege DB user is the access control.
export async function authorize(permission: Permission): Promise<AuthResult> {
  if (!(await assertSameOrigin())) return { ok: false, error: "Request blocked." };
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, error: "Please sign in again." };
  if (!can(admin, permission)) {
    return { ok: false, error: "You don't have permission to do this." };
  }
  return { ok: true, admin };
}
