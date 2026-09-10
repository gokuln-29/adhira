import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { getAllOrdersAdmin } from "@/lib/data/admin/orders";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// Route handlers aren't covered by the `(dashboard)` layout's auth check —
// layouts only wrap page.tsx, not route.ts — so this re-checks admin auth.
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    },
  });
}
