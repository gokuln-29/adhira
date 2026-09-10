"use client";

import { useRouter } from "next/navigation";
import { MonoLabel } from "@/components/ui/mono-label";
import { createClient } from "@/lib/supabase/client";
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
        <button
          type="button"
          className="font-mono-label text-[11px] text-(--color-muted) hover:text-(--color-primary)"
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
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
