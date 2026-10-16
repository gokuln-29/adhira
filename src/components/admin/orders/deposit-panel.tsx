"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MonoLabel } from "@/components/ui/mono-label";
import { updateDepositStatus } from "@/lib/actions/admin/orders";
import { formatAED } from "@/lib/pricing";

export function DepositPanel({
  number,
  total,
  status,
  canRefund,
}: {
  number: string;
  total: number;
  status: "held" | "refunded";
  canRefund: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = status === "held" ? "refunded" : "held";

  async function toggle() {
    if (next === "refunded" && !confirm("Confirm the items are returned and the deposit has been refunded to the customer?")) return;
    setSaving(true);
    setError(null);
    const result = await updateDepositStatus(number, next);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Card className="p-6">
      <MonoLabel muted={false} className="mb-3">
        Refundable deposit
      </MonoLabel>
      <p className="font-mono-label text-lg">{formatAED(total)}</p>
      <p className={`mt-1 text-sm ${status === "held" ? "text-amber-700" : "text-(--color-primary)"}`}>
        {status === "held" ? "Held: refund when the vessel or plant is returned" : "Refunded"}
      </p>
      {canRefund ? (
        <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={toggle} className="mt-3">
          {status === "held" ? "Mark as refunded" : "Undo refund mark"}
        </Button>
      ) : (
        <p className="mt-3 text-xs text-(--color-muted)">Only owners and managers can mark refunds.</p>
      )}
      <p className="mt-3 text-xs text-(--color-muted)">
        This only records the refund. Return the money to the customer yourself (cash, bank or Stripe).
      </p>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </Card>
  );
}
