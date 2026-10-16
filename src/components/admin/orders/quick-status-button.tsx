"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus } from "@/lib/actions/admin/orders";
import type { OrderStatus } from "@/lib/constants/order";

// The normal life of an order, so the common case is one click.
const NEXT: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  pending: { status: "confirmed", label: "Confirm order" },
  confirmed: { status: "preparing", label: "Start preparing" },
  preparing: { status: "dispatched", label: "Out for delivery" },
  dispatched: { status: "delivered", label: "Mark delivered" },
};

export function QuickStatusButton({ number, status }: { number: string; status: OrderStatus }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = NEXT[status];
  if (!next) return null;

  return (
    <span className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          setError(null);
          const result = await updateOrderStatus(number, next.status);
          setSaving(false);
          if (!result.ok) setError(result.error);
          else router.refresh();
        }}
        className="border border-(--color-primary) px-2.5 py-1 font-mono-label text-[10px] text-(--color-primary) hover:bg-(--color-primary) hover:text-white disabled:opacity-40"
      >
        {saving ? "..." : next.label}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
