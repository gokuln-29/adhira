"use client";

import { useRouter } from "next/navigation";
import { MonoLabel } from "@/components/ui/mono-label";
import Link from "next/link";
import { adminLogout } from "@/lib/actions/admin/auth";
import type { AdminUser } from "@/lib/admin/auth";

export function AdminTopbar({ admin }: { admin: AdminUser }) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between border-b border-(--color-hairline) py-4 pe-4 ps-14 sm:pe-6 lg:ps-6">
      <div />
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
        <MonoLabel>
          {admin.name} &middot; {admin.role}
        </MonoLabel>
        <Link href="/admin/account" className="font-mono-label text-[11px] text-(--color-muted) hover:text-(--color-primary)">
          Account
        </Link>
        <button
          type="button"
          className="font-mono-label text-[11px] text-(--color-muted) hover:text-(--color-primary)"
          onClick={async () => {
            await adminLogout();
            router.push("/admin/login");
            router.refresh();
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
