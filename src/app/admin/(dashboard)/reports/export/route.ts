import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin/auth";
import { getAllOrdersAdmin } from "@/lib/data/admin/orders";

// Also neutralises spreadsheet formula injection: a customer who registers as
// `=HYPERLINK(...)` would otherwise run code when staff open the export.
function csvEscape(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

// Route handlers aren't covered by the `(dashboard)` layout's auth check —
// layouts only wrap page.tsx, not route.ts — so this re-checks admin auth.
export async function GET() {
  const auth = await authorize("editContent");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const orders = await getAllOrdersAdmin();

  const header = ["Order", "Customer", "Email", "Channel", "Emirate", "Status", "Total (AED)", "Created"];
  const rows = orders.map((o) => [
    o.number,
    o.customers?.name ?? "",
    o.customers?.email ?? "",
    o.channel,
    o.emirate ?? "",
    o.status,
    o.total.toFixed(2),
    o.created_at,
  ]);

  const csv = [header, ...rows].map((row) => row.map((v) => csvEscape(String(v))).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="orders.csv"',
      "Cache-Control": "no-store",
    },
  });
}
