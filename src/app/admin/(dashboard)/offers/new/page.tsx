import type { Metadata } from "next";
import { OfferForm } from "@/components/admin/offers/offer-form";
import { getOfferPickOptions } from "@/lib/data/admin/pick-options";

export const metadata: Metadata = { title: "New Offer" };

export default async function NewOfferPage() {
  const pick = await getOfferPickOptions();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">New offer</h1>
      <OfferForm categories={pick.categories} products={pick.products} />
    </div>
  );
}
