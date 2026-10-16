import Link from "next/link";
import { Card } from "@/components/ui/card";
import { MonoLabel } from "@/components/ui/mono-label";
import type { LowStockProduct } from "@/lib/ops/stock";

// Products that track stock and are at or below the alert level (Settings > Stock alerts).
export function LowStockPanel({ items, threshold }: { items: LowStockProduct[]; threshold: number }) {
  if (items.length === 0) return null;
  const out = items.filter((i) => i.status === "out").length;
  return (
    <Card className="flex flex-col gap-3 p-5" aria-label="Low stock">
      <div className="flex items-baseline justify-between gap-4">
        <MonoLabel muted={false}>
          Stock: {out > 0 ? `${out} out, ` : ""}
          {items.length - out} low
        </MonoLabel>
        <span className="text-xs text-(--color-muted)">alert level {threshold} units</span>
      </div>
      <ul className="divide-y divide-(--color-hairline) text-sm">
        {items.slice(0, 8).map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-4 py-2">
            <Link href={`/admin/products/${i.id}`} className="hover:text-(--color-primary)">
              {i.name}
            </Link>
            <span className={`font-mono-label text-[11px] ${i.status === "out" ? "text-red-700" : "text-amber-700"}`}>
              {i.status === "out" ? "OUT OF STOCK" : `${i.stock_qty} LEFT`}
            </span>
          </li>
        ))}
      </ul>
      {items.length > 8 && (
        <Link href="/admin/products" className="text-xs underline underline-offset-4">
          and {items.length - 8} more in Products
        </Link>
      )}
    </Card>
  );
}
