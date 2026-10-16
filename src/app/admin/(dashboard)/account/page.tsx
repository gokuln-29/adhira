import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MonoLabel } from "@/components/ui/mono-label";
import { SecurityPanel } from "@/components/admin/account/security-panel";
import { readAdminSession } from "@/lib/auth/admin-session";

export const metadata: Metadata = { title: "My account" };

export default async function AdminAccountPage() {
  const session = await readAdminSession();
  if (!session?.mfaPassed) redirect("/admin/login");

  return (
    <div className="flex max-w-xl flex-col gap-8">
      <h1 className="text-2xl font-semibold">My account</h1>
      <p className="text-sm text-(--color-muted)">{session.admin.email}</p>
      <section className="flex flex-col gap-4">
        <MonoLabel muted={false}>Two-factor authentication</MonoLabel>
        <SecurityPanel totpEnabled={session.admin.totp_enabled} />
      </section>
    </div>
  );
}
