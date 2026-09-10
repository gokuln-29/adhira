import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/ui/mono-label";
import { getAllOffersAdmin } from "@/lib/data/admin/offers";

export const metadata: Metadata = { title: "Offers & Coupons" };

export default async function AdminOffersPage() {
  const offers = await getAllOffersAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Offers &amp; Coupons</h1>
        <Link href="/admin/offers/new">
          <Button type="button">+ New offer</Button>
        </Link>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-(--color-hairline) font-mono-label text-[10px] text-(--color-muted)">
              <th className="px-6 py-3 text-start">Title</th>
              <th className="px-6 py-3 text-start">Code</th>
              <th className="px-6 py-3 text-start">Value</th>
              <th className="px-6 py-3 text-start">Window</th>
              <th className="px-6 py-3 text-start">Status</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((o) => (
              <tr key={o.id} className="border-b border-(--color-hairline) last:border-0">
                <td className="px-6 py-3">
                  <Link href={`/admin/offers/${o.id}`} className="hover:text-(--color-primary)">
                    {o.title}
                  </Link>
                </td>
                <td className="px-6 py-3 font-mono-label text-xs">{o.code ?? "—"}</td>
                <td className="px-6 py-3 font-mono-label text-xs">
                  {o.type === "percent" ? `${o.value}%` : `AED ${o.value}`}
                </td>
                <td className="px-6 py-3 text-(--color-muted)">
                  {o.ends ? new Date(o.ends).toLocaleDateString("en-AE") : "No end date"}
                </td>
                <td className="px-6 py-3">
                  <MonoLabel muted={false} className="text-[10px]">
                    {o.active ? "ACTIVE" : "INACTIVE"}
                  </MonoLabel>
                </td>
              </tr>
            ))}
            {offers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-(--color-muted)">
                  No offers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
