"use client";

import { useRouter } from "next/navigation";
import { deleteRedirect } from "@/lib/actions/admin/redirects";

export function DeleteRedirectButton({ id, from }: { id: string; from: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="font-mono-label text-[10px] text-red-600"
      onClick={async () => {
        if (!confirm(`Stop redirecting ${from}? That link will show "not found".`)) return;
        await deleteRedirect(id);
        router.refresh();
      }}
    >
      Remove
    </button>
  );
}
