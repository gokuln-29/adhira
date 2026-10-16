"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createOffer, updateOffer, deleteOffer, type OfferFormInput } from "@/lib/actions/admin/offers";
import type { OfferWithTargets } from "@/lib/data/admin/offers";

export interface PickOption {
  id: string;
  name: string;
}

export function OfferForm({
  offer,
  categories,
  products,
}: {
  offer?: OfferWithTargets;
  categories: PickOption[];
  products: PickOption[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(offer?.title ?? "");
  const [type, setType] = useState<"percent" | "flat">(offer?.type === "flat" ? "flat" : "percent");
  const [value, setValue] = useState(String(offer?.value ?? ""));
  const [code, setCode] = useState(offer?.code ?? "");
  const [scope, setScope] = useState<"all" | "category" | "product">(offer?.scope ?? "all");
  const [categoryIds, setCategoryIds] = useState<string[]>(offer?.category_ids ?? []);
  const [productIds, setProductIds] = useState<string[]>(offer?.product_ids ?? []);
  const [minSubtotal, setMinSubtotal] = useState(String(offer?.min_subtotal ?? 0));
  const [maxUses, setMaxUses] = useState(offer?.max_uses == null ? "" : String(offer.max_uses));
  const [maxPerCustomer, setMaxPerCustomer] = useState(offer?.max_uses_per_customer == null ? "" : String(offer.max_uses_per_customer));
  const [starts, setStarts] = useState(offer?.starts?.slice(0, 10) ?? "");
  const [ends, setEnds] = useState(offer?.ends?.slice(0, 10) ?? "");
  const [active, setActive] = useState(offer?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const legacy = offer && offer.type !== "percent" && offer.type !== "flat";
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  async function handleSave() {
    setSaving(true);
    setError(null);

    const input: OfferFormInput = {
      title,
      type,
      value: Number(value) || 0,
      code: code.trim() || null,
      scope,
      category_ids: categoryIds,
      product_ids: productIds,
      min_subtotal: Number(minSubtotal) || 0,
      max_uses: maxUses.trim() ? Number(maxUses) : null,
      max_uses_per_customer: maxPerCustomer.trim() ? Number(maxPerCustomer) : null,
      starts: starts || null,
      ends: ends || null,
      active,
    };

    const result = offer ? await updateOffer(offer.id, input) : await createOffer(input);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/admin/offers");
    router.refresh();
  }

  async function handleDelete() {
    if (!offer || !confirm(`Delete "${offer.title}"?`)) return;
    setSaving(true);
    const result = await deleteOffer(offer.id);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/admin/offers");
    router.refresh();
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      {legacy && (
        <p className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This offer uses the old &ldquo;code-only&rdquo; type, which can&apos;t be redeemed. Choose percent or flat and save to make its code work.
        </p>
      )}
      <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <div className="grid grid-cols-2 gap-4">
        <Select label="Discount type" value={type} onChange={(e) => setType(e.target.value as "percent" | "flat")}>
          <option value="percent">Percent off</option>
          <option value="flat">Flat amount off (AED)</option>
        </Select>
        <Input
          label={type === "percent" ? "Percent (1-100)" : "Amount (AED, before VAT)"}
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <Input
        label="Code customers type at checkout"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        hint="Letters, digits, - or _ (3-40). Leave empty for an announcement-only offer that can't be redeemed."
      />

      <Select label="Applies to" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
        <option value="all">All products</option>
        <option value="category">Selected categories</option>
        <option value="product">Selected products</option>
      </Select>
      {scope === "category" && (
        <fieldset className="grid max-h-48 gap-2 overflow-y-auto border border-(--color-hairline) p-3 text-sm sm:grid-cols-2">
          {categories.map((c) => (
            <label key={c.id} className="flex items-center gap-2">
              <input type="checkbox" checked={categoryIds.includes(c.id)} onChange={() => setCategoryIds((l) => toggle(l, c.id))} />
              {c.name}
            </label>
          ))}
        </fieldset>
      )}
      {scope === "product" && (
        <fieldset className="grid max-h-64 gap-2 overflow-y-auto border border-(--color-hairline) p-3 text-sm sm:grid-cols-2">
          {products.map((p) => (
            <label key={p.id} className="flex items-center gap-2">
              <input type="checkbox" checked={productIds.includes(p.id)} onChange={() => setProductIds((l) => toggle(l, p.id))} />
              {p.name}
            </label>
          ))}
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          label="Minimum spend (AED)"
          type="number"
          min="0"
          step="0.01"
          value={minSubtotal}
          onChange={(e) => setMinSubtotal(e.target.value)}
          hint="Eligible goods, before VAT"
        />
        <Input label="Total uses allowed" type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} hint="Empty = unlimited" />
        <Input
          label="Uses per customer"
          type="number"
          min="1"
          value={maxPerCustomer}
          onChange={(e) => setMaxPerCustomer(e.target.value)}
          hint="By email. Empty = unlimited"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="First day" type="date" value={starts} onChange={(e) => setStarts(e.target.value)} />
        <Input label="Last day (included)" type="date" value={ends} onChange={(e) => setEnds(e.target.value)} />
      </div>
      <p className="text-xs text-(--color-muted)">
        The discount comes off the eligible goods before VAT (delivery and refundable deposits are never discounted), and VAT is
        charged on what remains. One code per order. It stacks with a product&apos;s own sale price. Cancelled orders give their use back.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active
      </label>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex items-center justify-between pt-2">
        {offer && (
          <button type="button" onClick={handleDelete} className="font-mono-label text-[11px] text-red-600">
            Delete
          </button>
        )}
        <Button type="button" disabled={saving} onClick={handleSave} className="ms-auto">
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
