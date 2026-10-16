"use client";

import { useRouter } from "next/navigation";
import { MonoLabel } from "@/components/ui/mono-label";
import Link from "next/link";
import { adminLogout } from "@/lib/actions/admin/auth";
import type { AdminUser } from "@/lib/admin/auth";

export function AdminTopbar({ admin }: { admin: AdminUser }) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between border-b border-(--color-hairline) px-6 py-4">
      <div />
      <div className="flex items-center gap-4">
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
