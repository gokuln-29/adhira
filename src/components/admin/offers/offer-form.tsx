"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createOffer, updateOffer, deleteOffer, type OfferFormInput } from "@/lib/actions/admin/offers";
import type { OfferRow } from "@/lib/data/types";

export function OfferForm({ offer }: { offer?: OfferRow }) {
  const router = useRouter();
  const [title, setTitle] = useState(offer?.title ?? "");
  const [type, setType] = useState<OfferFormInput["type"]>(offer?.type ?? "percent");
  const [value, setValue] = useState(String(offer?.value ?? ""));
  const [code, setCode] = useState(offer?.code ?? "");
  const [scope, setScope] = useState(offer?.scope ?? "all");
  const [starts, setStarts] = useState(offer?.starts?.slice(0, 10) ?? "");
  const [ends, setEnds] = useState(offer?.ends?.slice(0, 10) ?? "");
  const [active, setActive] = useState(offer?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);

    const input: OfferFormInput = {
      title,
      type,
      value: Number(value) || 0,
      code: code || null,
      scope,
      starts: starts ? new Date(starts).toISOString() : null,
      ends: ends ? new Date(ends).toISOString() : null,
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
    <div className="flex max-w-xl flex-col gap-4">
      <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <div className="grid grid-cols-2 gap-4">
        <Select label="Type" value={type} onChange={(e) => setType(e.target.value as OfferFormInput["type"])}>
          <option value="percent">Percent</option>
          <option value="flat">Flat (AED)</option>
          <option value="code">Code-only</option>
        </Select>
        <Input label="Value" type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <Input label="Code (optional)" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
      <Select label="Scope" value={scope} onChange={(e) => setScope(e.target.value)}>
        <option value="all">All products</option>
        <option value="category">Category</option>
        <option value="product">Product</option>
      </Select>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Starts" type="date" value={starts} onChange={(e) => setStarts(e.target.value)} />
        <Input label="Ends" type="date" value={ends} onChange={(e) => setEnds(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active
      </label>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex items-center justify-between pt-2">
        {offer && (
          <button
            type="button"
            onClick={handleDelete}
            className="font-mono-label text-[11px] text-red-600"
          >
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
