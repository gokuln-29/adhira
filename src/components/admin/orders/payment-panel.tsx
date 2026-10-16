import { Card } from "@/components/ui/card";
import { MonoLabel } from "@/components/ui/mono-label";

// Payment is never edited by hand: card orders are marked paid only by the
// verified Stripe webhook.
export function PaymentPanel({ method, status }: { method: string; status: string }) {
  return (
    <Card className="p-6">
      <MonoLabel muted={false} className="mb-3">
        Payment
      </MonoLabel>
      <p className="text-sm">
        {method === "link" ? "Payment link" : method === "cod" ? "Cash on delivery (legacy)" : "Card (Stripe)"}
        {" · "}
        <b>{status.toUpperCase()}</b>
      </p>
      {status === "unpaid" && (
        <p className="mt-2 text-xs text-(--color-muted)">
          Turns paid automatically when Stripe confirms the payment. Unpaid checkouts are cancelled when the Stripe session expires.
        </p>
      )}
    </Card>
  );
}
