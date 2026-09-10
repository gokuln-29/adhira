import type { Metadata } from "next";
import { OfferForm } from "@/components/admin/offers/offer-form";

export const metadata: Metadata = { title: "New Offer" };

export default function NewOfferPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">New offer</h1>
      <OfferForm />
    </div>
  );
}
