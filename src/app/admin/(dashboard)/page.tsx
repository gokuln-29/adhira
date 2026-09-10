import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { MonoLabel } from "@/components/ui/mono-label";
import { StatTile } from "@/components/admin/dashboard/stat-tile";
import { RevenueChart } from "@/components/admin/dashboard/revenue-chart";
import { DonutChart } from "@/components/admin/dashboard/donut-chart";
import { getDashboardData } from "@/lib/data/admin/dashboard";
import { formatAED } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const ranges = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysParam } = await searchParams;
  const days = Number(daysParam) || 30;
  const data = await getDashboardData(days);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex gap-2">
          {ranges.map((r) => (
            <Link
              key={r.days}
              href={`/admin?days=${r.days}`}
              className={cn(
                "border px-3 py-1.5 font-mono-label text-[11px]",
                days === r.days
                  ? "border-(--color-primary) text-(--color-primary)"
                  : "border-(--color-hairline) text-(--color-muted) hover:text-(--color-ink)",
              )}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Revenue"
          value={formatAED(data.revenue)}
          previous={data.revenuePrev}
          currentRaw={data.revenue}
        />
        <StatTile
          label="Orders"
          value={String(data.orderCount)}
          previous={data.orderCountPrev}
          currentRaw={data.orderCount}
        />
        <StatTile
          label="AOV"
          value={formatAED(data.aov)}
          previous={data.aovPrev}
          currentRaw={data.aov}
        />
        <StatTile
          label="Pending Payments"
          value={`${data.pendingCount} · ${formatAED(data.pendingTotal)}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <MonoLabel muted={false} className="mb-4">
            Revenue
          </MonoLabel>
          <RevenueChart data={data.revenueByDay} />
        </Card>

        <Card className="p-6">
          <MonoLabel muted={false} className="mb-4">
            Sales by Category
          </MonoLabel>
          <DonutChart data={data.categorySplit} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-6">
          <MonoLabel muted={false} className="mb-4">
            Retail vs Corporate
          </MonoLabel>
          <DonutChart
            data={[
              { name: "Retail", value: data.channelSplit.retail },
              { name: "Corporate", value: data.channelSplit.corporate },
            ]}
          />
        </Card>

        <Card className="p-6">
          <MonoLabel muted={false} className="mb-4">
            Unpaid Payment Links
          </MonoLabel>
          <p className="font-mono-label text-2xl">{data.unpaidLinksCount}</p>
          <MonoLabel className="mt-1 text-[11px]">
            {formatAED(data.unpaidLinksTotal)} outstanding
          </MonoLabel>
          <Link
            href="/admin/payment-links"
            className="mt-3 block font-mono-label text-[11px] text-(--color-primary)"
          >
            View payment links →
          </Link>
        </Card>

        <Card className="p-6">
          <MonoLabel muted={false} className="mb-2">
            Low Stock
          </MonoLabel>
          <p className="text-sm text-(--color-muted)">
            Not tracked yet — products don&apos;t carry inventory counts in this
            schema. Add a stock column if per-item availability tracking becomes
            a requirement.
          </p>
        </Card>
      </div>

      <Card className="overflow-x-auto">
        <div className="border-b border-(--color-hairline) p-6">
          <MonoLabel muted={false}>Recent Orders</MonoLabel>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-(--color-hairline) font-mono-label text-[10px] text-(--color-muted)">
              <th className="px-6 py-3 text-start">Order</th>
              <th className="px-6 py-3 text-start">Customer</th>
              <th className="px-6 py-3 text-start">Status</th>
              <th className="px-6 py-3 text-start">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.recentOrders.map((o) => (
              <tr key={o.number} className="border-b border-(--color-hairline) last:border-0">
                <td className="px-6 py-3">
                  <Link href={`/admin/orders/${o.number}`} className="hover:text-(--color-primary)">
                    {o.number}
                  </Link>
                </td>
                <td className="px-6 py-3 text-(--color-muted)">{o.customerName}</td>
                <td className="px-6 py-3 font-mono-label text-[10px]">{o.status.toUpperCase()}</td>
                <td className="px-6 py-3 font-mono-label text-xs">{formatAED(o.total)}</td>
              </tr>
            ))}
            {data.recentOrders.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-(--color-muted)">
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
