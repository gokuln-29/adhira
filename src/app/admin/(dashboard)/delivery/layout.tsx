import { requirePermission } from "@/lib/admin/auth";

export default async function DeliveryLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("ownerOnly");
  return children;
}
