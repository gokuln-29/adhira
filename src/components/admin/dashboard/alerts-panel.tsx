"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { resolveAlert } from "@/lib/actions/admin/alerts";
import type { OpenAlert } from "@/lib/ops/alerts";

export function AlertsPanel({ alerts }: { alerts: OpenAlert[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  if (alerts.length === 0) return null;

  return (
    <section aria-label="Needs attention" className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-red-700">
        Needs attention ({alerts.length})
      </h2>
      {alerts.map((a) => (
        <div key={a.id} role="alert" className="flex flex-col gap-2 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold">{a.title}</p>
              <p className="text-xs opacity-70">
                {new Date(a.created_at).toLocaleString("en-GB", { timeZone: "Asia/Dubai" })}
                {a.occurrences > 1 ? ` · happened ${a.occurrences} times` : ""}
              </p>
            </div>
            <button
              type="button"
              disabled={busy === a.id}
              onClick={async () => {
                setBusy(a.id);
                await resolveAlert(a.id);
                setBusy(null);
                router.refresh();
              }}
              className="shrink-0 border border-red-400 px-2.5 py-1 font-mono-label text-[10px] hover:bg-red-100 disabled:opacity-40"
            >
              {busy === a.id ? "..." : "Resolve"}
            </button>
          </div>
          {a.details && <p className="whitespace-pre-wrap text-xs">{a.details}</p>}
          {a.order_number && (
            <Link href={`/admin/orders/${a.order_number}`} className="w-fit text-xs underline">
              Open order {a.order_number}
            </Link>
          )}
        </div>
      ))}
    </section>
  );
}
