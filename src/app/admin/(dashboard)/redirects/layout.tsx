import { requirePermission } from "@/lib/admin/auth";

export default async function RedirectsLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("editContent");
  return children;
}
