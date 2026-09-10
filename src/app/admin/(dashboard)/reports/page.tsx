import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { MonoLabel } from "@/components/ui/mono-label";

export const metadata: Metadata = { title: "Reports" };

export default function AdminReportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Reports</h1>

      <Card className="flex flex-col gap-3 p-6">
        <MonoLabel muted={false}>Orders export</MonoLabel>
        <p className="text-sm text-(--color-muted)">
          Every order with its customer, channel, status and totals, as CSV.
        </p>
        {/* Full navigation, not a route: triggers a Content-Disposition download */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/admin/reports/export"
          className="w-fit border border-(--color-hairline) px-4 py-2 font-mono-label text-xs hover:border-(--color-primary) hover:text-(--color-primary)"
        >
          Download orders.csv
        </a>
      </Card>
    </div>
  );
}
