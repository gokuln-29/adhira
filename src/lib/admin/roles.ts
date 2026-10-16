// Pure role logic with no server imports, so client components (the sidebar)
// can share it with server code. `authorize()` in `lib/admin/auth.ts` is
// the real enforcement; this also drives what the UI shows.
export type AdminRole = "owner" | "manager" | "staff";

export interface AdminUser {
  id: string;
  name: string;
  role: AdminRole;
}

export const ROLE_PERMISSIONS = {
  // Catalog, offers, blog, reports
  editContent: ["owner", "manager"],
  // Orders, leads, customers
  handleOrders: ["owner", "manager", "staff"],
  // Staff accounts, payment links
  ownerOnly: ["owner"],
} as const satisfies Record<string, readonly AdminRole[]>;

export type Permission = keyof typeof ROLE_PERMISSIONS;

export function roleCan(role: AdminRole | null | undefined, permission: Permission): boolean {
  return !!role && (ROLE_PERMISSIONS[permission] as readonly AdminRole[]).includes(role);
}
