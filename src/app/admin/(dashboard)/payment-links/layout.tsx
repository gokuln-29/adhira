import { requirePermission } from "@/lib/admin/auth";

// Route-level guard: the sidebar hides this section from roles that can't use
// it, and this stops them reaching it by typing the URL.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requirePermission("ownerOnly");
  return children;
}
