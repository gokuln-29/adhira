import type { Metadata } from "next";
import { PaymentLinksPanel } from "@/components/admin/payment-links/payment-links-panel";
import { getAllPaymentLinksAdmin } from "@/lib/data/admin/payment-links";

export const metadata: Metadata = { title: "Payment Links" };

export default async function AdminPaymentLinksPage() {
  const links = await getAllPaymentLinksAdmin();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Payment Links</h1>
      <PaymentLinksPanel links={links} />
    </div>
  );
}
