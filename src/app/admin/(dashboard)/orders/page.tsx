import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { MonoLabel } from "@/components/ui/mono-label";
import { getAllOrdersAdmin } from "@/lib/data/admin/orders";
import { formatAED } from "@/lib/pricing";

export const metadata: Metadata = { title: "Orders" };

export default async function AdminOrdersPage() {
  const orders = await getAllOrdersAdmin();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Orders</h1>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-(--color-hairline) font-mono-label text-[10px] text-(--color-muted)">
              <th className="px-6 py-3 text-start">Order</th>
              <th className="px-6 py-3 text-start">Customer</th>
              <th className="px-6 py-3 text-start">Channel</th>
              <th className="px-6 py-3 text-start">Emirate</th>
              <th className="px-6 py-3 text-start">Status</th>
              <th className="px-6 py-3 text-start">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.number} className="border-b border-(--color-hairline) last:border-0">
                <td className="px-6 py-3">
                  <Link
                    href={`/admin/orders/${o.number}`}
                    className="hover:text-(--color-primary)"
                  >
                    {o.number}
                  </Link>
                </td>
                <td className="px-6 py-3 text-(--color-muted)">
                  {o.customers?.name ?? "—"}
                </td>
                <td className="px-6 py-3 font-mono-label text-[10px]">
                  {o.channel.toUpperCase()}
                </td>
                <td className="px-6 py-3 text-(--color-muted)">{o.emirate ?? "—"}</td>
                <td className="px-6 py-3">
                  <MonoLabel muted={false} className="text-[10px]">
                    {o.status.toUpperCase()}
                  </MonoLabel>
                </td>
                <td className="px-6 py-3 font-mono-label text-xs">{formatAED(o.total)}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-(--color-muted)">
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
