import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OfferForm } from "@/components/admin/offers/offer-form";
import { getOfferByIdAdmin } from "@/lib/data/admin/offers";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const offer = await getOfferByIdAdmin(id);
  return { title: offer?.title ?? "Edit Offer" };
}

export default async function EditOfferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const offer = await getOfferByIdAdmin(id);
  if (!offer) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{offer.title}</h1>
      <OfferForm offer={offer} />
    </div>
  );
}
