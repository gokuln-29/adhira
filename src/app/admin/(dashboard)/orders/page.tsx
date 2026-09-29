import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { MonoLabel } from "@/components/ui/mono-label";
import { QuickStatusButton } from "@/components/admin/orders/quick-status-button";
import {
  getOrdersPageAdmin,
  ORDERS_PAGE_SIZE,
  ORDER_VIEWS,
  type OrderView,
} from "@/lib/data/admin/orders";
import type { OrderStatus } from "@/lib/constants/order";
import { formatAED } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };

const VIEWS: { key: OrderView; label: string }[] = [
  { key: "action", label: "Needs action" },
  { key: "progress", label: "In progress" },
  { key: "delivered", label: "Delivered" },
  { key: "closed", label: "Cancelled / refunded" },
  { key: "all", label: "All" },
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; page?: string }>;
}) {
  const params = await searchParams;
  const view: OrderView = params.view && params.view in ORDER_VIEWS ? (params.view as OrderView) : "action";
  const pageRaw = Number(params.page);
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const { rows: orders, total } = await getOrdersPageAdmin({ view, page });
  const pages = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));
  const href = (v: OrderView, p = 1) => `/admin/orders?view=${v}${p > 1 ? `&page=${p}` : ""}`;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Orders</h1>

      <nav aria-label="Order filters" className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={href(v.key)}
            className={cn(
              "border px-3 py-1.5 font-mono-label text-[11px]",
              view === v.key
                ? "border-(--color-primary) text-(--color-primary)"
                : "border-(--color-hairline) text-(--color-muted) hover:text-(--color-ink)",
            )}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-(--color-hairline) font-mono-label text-[10px] text-(--color-muted)">
              <th className="px-4 py-3 text-start">Order</th>
              <th className="px-4 py-3 text-start">Customer</th>
              <th className="px-4 py-3 text-start">Deliver on</th>
              <th className="px-4 py-3 text-start">Emirate</th>
              <th className="px-4 py-3 text-start">Status</th>
              <th className="px-4 py-3 text-start">Total</th>
              <th className="px-4 py-3 text-start">Next step</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.number} className="border-b border-(--color-hairline) last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${o.number}`} className="hover:text-(--color-primary)">
                    {o.number}
                  </Link>
                  {o.channel === "corporate" && (
                    <span className="ms-2 font-mono-label text-[9px] text-(--color-primary)">CORP</span>
                  )}
                  {o.deposit_status === "held" && (
                    <span className="ms-2 font-mono-label text-[9px] text-amber-700">DEPOSIT</span>
                  )}
                </td>
                <td className="px-4 py-3 text-(--color-muted)">{o.customers?.name ?? "—"}</td>
                <td className="px-4 py-3 font-mono-label text-xs">
                  {o.delivery_date
                    ? new Date(`${o.delivery_date}T00:00:00`).toLocaleDateString("en-AE", { day: "numeric", month: "short" })
                    : "ASAP"}
                </td>
                <td className="px-4 py-3 text-(--color-muted)">{o.emirate ?? "—"}</td>
                <td className="px-4 py-3">
                  <MonoLabel muted={false} className="text-[10px]">
                    {o.status.replace(/_/g, " ").toUpperCase()}
                  </MonoLabel>
                </td>
                <td className="px-4 py-3 font-mono-label text-xs">{formatAED(o.total)}</td>
                <td className="px-4 py-3">
                  <QuickStatusButton number={o.number} status={o.status as OrderStatus} />
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-(--color-muted)">
                  Nothing here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between font-mono-label text-xs">
          {page > 1 ? <Link href={href(view, page - 1)} className="text-(--color-primary)">← Previous</Link> : <span />}
          <span className="text-(--color-muted)">
            Page {page} of {pages} · {total} orders
          </span>
          {page < pages ? <Link href={href(view, page + 1)} className="text-(--color-primary)">Next →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
