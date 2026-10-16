"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/ui/mono-label";
import { formatAED } from "@/lib/pricing";
import { bulkDeleteProducts, bulkUpdateProductStatus } from "@/lib/actions/admin/products";
import { stockStatus } from "@/lib/stock";
import type { CategoryRow, ProductRow } from "@/lib/data/types";

export function ProductsTable({
  products,
  categories,
  lowStockThreshold,
}: {
  products: ProductRow[];
  categories: CategoryRow[];
  lowStockThreshold: number;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (status && p.status !== status) return false;
      if (category && p.category_id !== category) return false;
      return true;
    });
  }, [products, search, status, category]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((p) => p.id)),
    );
  }

  async function runBulk(action: "publish" | "draft" | "delete") {
    if (selected.size === 0) return;
    if (action === "delete" && !confirm(`Delete ${selected.size} product(s)?`)) return;

    setBusy(true);
    const ids = Array.from(selected);
    const result =
      action === "delete"
        ? await bulkDeleteProducts(ids)
        : await bulkUpdateProductStatus(ids, action === "publish" ? "active" : "draft");
    setBusy(false);

    if (result.ok) {
      setSelected(new Set());
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Input
          label="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Product name"
        />
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
        </Select>
        <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Link href="/admin/products/new" className="ms-auto">
          <Button type="button">+ New product</Button>
        </Link>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 border border-(--color-hairline) bg-(--color-primary)/5 px-4 py-2">
          <MonoLabel className="text-[11px]">{selected.size} selected</MonoLabel>
          <button
            type="button"
            disabled={busy}
            onClick={() => runBulk("publish")}
            className="font-mono-label text-[11px] text-(--color-primary)"
          >
            Publish
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => runBulk("draft")}
            className="font-mono-label text-[11px] text-(--color-muted)"
          >
            Set draft
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => runBulk("delete")}
            className="font-mono-label text-[11px] text-red-600"
          >
            Delete
          </button>
        </div>
      )}

      <div className="overflow-x-auto border border-(--color-hairline)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-(--color-hairline) text-start font-mono-label text-[10px] text-(--color-muted)">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.size === filtered.length && filtered.length > 0}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-4 py-3 text-start">Product</th>
              <th className="px-4 py-3 text-start">Category</th>
              <th className="px-4 py-3 text-start">Price</th>
              <th className="px-4 py-3 text-start">Stock</th>
              <th className="px-4 py-3 text-start">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-(--color-hairline) last:border-0">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/products/${p.id}`} className="hover:text-(--color-primary)">
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-(--color-muted)">
                  {p.categories?.name ?? "—"}
                </td>
                <td className="px-4 py-3 font-mono-label text-xs">
                  {formatAED(p.base_price)}
                </td>
                <td className="px-4 py-3 font-mono-label text-xs">
                  {(() => {
                    const st = stockStatus(p.stock_qty, lowStockThreshold);
                    if (st === "untracked") return <span className="text-(--color-muted)">—</span>;
                    return (
                      <span className={st === "out" ? "text-red-700" : st === "low" ? "text-amber-700" : ""}>
                        {p.stock_qty}
                        {st === "out" ? " · OUT" : st === "low" ? " · LOW" : ""}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`font-mono-label text-[10px] ${p.status === "active" ? "text-(--color-primary)" : "text-(--color-muted)"}`}
                  >
                    {p.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-(--color-muted)">
                  No products match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
