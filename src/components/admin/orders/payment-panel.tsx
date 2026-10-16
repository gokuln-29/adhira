"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { MonoLabel } from "@/components/ui/mono-label";
import { markCashReceived } from "@/lib/actions/admin/orders";

export function PaymentPanel({
  number,
  method,
  status,
  canMarkPaid,
}: {
  number: string;
  method: string;
  status: string;
  canMarkPaid: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card className="p-6">
      <MonoLabel muted={false} className="mb-3">
        Payment
      </MonoLabel>
      <p className="text-sm">
        {method === "cod" ? "Cash on delivery" : method === "card" ? "Card (Stripe)" : "Payment link"}
        {" · "}
        <b>{status.toUpperCase()}</b>
      </p>
      {status === "unpaid" && method === "cod" && canMarkPaid && (
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            if (!confirm("Confirm the cash / transfer has been received?")) return;
            setSaving(true);
            const res = await markCashReceived(number);
            setSaving(false);
            if (!res.ok) setError(res.error);
            else router.refresh();
          }}
          className="mt-3 border border-(--color-primary) px-2.5 py-1 font-mono-label text-[10px] text-(--color-primary) hover:bg-(--color-primary) hover:text-white disabled:opacity-40"
        >
          {saving ? "..." : "Mark cash received"}
        </button>
      )}
      {status === "unpaid" && method === "card" && (
        <p className="mt-2 text-xs text-(--color-muted)">Card orders turn paid automatically when Stripe confirms the payment.</p>
      )}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </Card>
  );
}
