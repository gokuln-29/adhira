"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MonoLabel } from "@/components/ui/mono-label";
import { markPaidManually } from "@/lib/actions/admin/orders";

const METHOD_LABEL: Record<string, string> = {
  card: "Card (Stripe)",
  link: "Payment link",
  manual: "Recorded manually (bank transfer / other)",
  cod: "Cash on delivery (legacy)",
};

// Card orders are marked paid only by the verified Stripe webhook. The owner can
// record a payment received some other way; that needs a reference and is logged.
export function PaymentPanel({
  number,
  method,
  status,
  orderStatus,
  canMarkPaid,
}: {
  number: string;
  method: string;
  status: string;
  orderStatus: string;
  canMarkPaid: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closed = orderStatus === "cancelled" || orderStatus === "refunded";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm("Record this order as paid? This is written to the order history.")) return;
    setSaving(true);
    setError(null);
    const res = await markPaidManually(number, reference);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setOpen(false);
    router.refresh();
  }

  return (
    <Card className="p-6">
      <MonoLabel muted={false} className="mb-3">
        Payment
      </MonoLabel>
      <p className="text-sm">
        {METHOD_LABEL[method] ?? method}
        {" · "}
        <b>{status.toUpperCase()}</b>
      </p>
      {status === "unpaid" && (
        <p className="mt-2 text-xs text-(--color-muted)">
          Turns paid automatically when Stripe confirms the payment. Unpaid checkouts are cancelled when the Stripe session expires.
        </p>
      )}
      {status === "unpaid" && canMarkPaid && !closed && (
        <div className="mt-3">
          {open ? (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <Input
                label="Reference (bank transfer no., Stripe payment ID…)"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                required
                minLength={3}
                maxLength={200}
              />
              {error && <p className="text-xs text-red-700">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="border border-(--color-primary) px-2.5 py-1 font-mono-label text-[10px] text-(--color-primary) hover:bg-(--color-primary) hover:text-white disabled:opacity-40"
                >
                  {saving ? "..." : "Record as paid"}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="font-mono-label text-[10px] text-(--color-muted)">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="font-mono-label text-[10px] text-(--color-primary) underline underline-offset-4"
            >
              Record a payment received outside Stripe
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
