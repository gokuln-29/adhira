"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MonoLabel } from "@/components/ui/mono-label";
import { createPaymentLink, markPaymentLinkStatus } from "@/lib/actions/admin/payment-links";
import { formatAED } from "@/lib/pricing";
import type { PaymentLinkRow } from "@/lib/data/admin/payment-links";

export function PaymentLinksPanel({ links }: { links: PaymentLinkRow[] }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    const result = await createPaymentLink({
      amount: Number(amount) || 0,
      description,
      customerEmail,
      url,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAmount("");
    setDescription("");
    setCustomerEmail("");
    setUrl("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4 p-6">
        <MonoLabel muted={false}>New payment link</MonoLabel>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Amount (AED)"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input
            label="Customer email (optional)"
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
          />
        </div>
        <Input
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Input
          label="Payment URL (fallback)"
          hint="Created automatically via Stripe when an amount is set and Stripe is configured. Only used if Stripe isn't set up yet."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <Button type="button" disabled={saving} onClick={handleCreate} className="w-fit">
          {saving ? "Creating..." : "Create link"}
        </Button>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-(--color-hairline) font-mono-label text-[10px] text-(--color-muted)">
              <th className="px-6 py-3 text-start">Description</th>
              <th className="px-6 py-3 text-start">Customer</th>
              <th className="px-6 py-3 text-start">Amount</th>
              <th className="px-6 py-3 text-start">Status</th>
              <th className="px-6 py-3 text-start">Actions</th>
            </tr>
          </thead>
          <tbody>
            {links.map((link) => {
              const whatsappText = encodeURIComponent(
                `Hi${link.customers?.name ? " " + link.customers.name : ""}, here's your payment link for ${link.description ?? "your order"} (${formatAED(link.amount)}): ${link.url ?? ""}`,
              );
              return (
                <tr key={link.id} className="border-b border-(--color-hairline) last:border-0">
                  <td className="px-6 py-3">{link.description ?? "—"}</td>
                  <td className="px-6 py-3 text-(--color-muted)">
                    {link.customers?.name ?? "—"}
                  </td>
                  <td className="px-6 py-3 font-mono-label text-xs">
                    {formatAED(link.amount)}
                  </td>
                  <td className="px-6 py-3">
                    <MonoLabel muted={false} className="text-[10px]">
                      {link.status.toUpperCase()}
                    </MonoLabel>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex gap-3">
                      {link.url && (
                        <>
                          <button
                            type="button"
                            className="font-mono-label text-[10px] text-(--color-primary)"
                            onClick={() => {
                              navigator.clipboard.writeText(link.url!);
                              setCopiedId(link.id);
                              setTimeout(() => setCopiedId(null), 1500);
                            }}
                          >
                            {copiedId === link.id ? "Copied" : "Copy"}
                          </button>
                          <a
                            href={`https://wa.me/?text=${whatsappText}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono-label text-[10px] text-(--color-primary)"
                          >
                            WhatsApp
                          </a>
                        </>
                      )}
                      {link.status !== "paid" && (
                        <button
                          type="button"
                          className="font-mono-label text-[10px] text-(--color-muted) hover:text-(--color-ink)"
                          onClick={async () => {
                            await markPaymentLinkStatus(link.id, "paid");
                            router.refresh();
                          }}
                        >
                          Mark paid
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {links.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-(--color-muted)">
                  No payment links yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
