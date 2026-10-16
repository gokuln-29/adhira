"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { uploadImage } from "@/lib/media/upload-client";
import { updateStoreSettings } from "@/lib/actions/admin/settings";
import type { StoreSettings } from "@/lib/data/settings";

export function StoreSettingsForm({ settings }: { settings: StoreSettings }) {
  const router = useRouter();
  const [whatsapp, setWhatsapp] = useState(settings.whatsapp_number ?? "");
  const [phone, setPhone] = useState(settings.contact_phone ?? "");
  const [email, setEmail] = useState(settings.contact_email ?? "");
  const [trn, setTrn] = useState(settings.trn ?? "");
  const [legalName, setLegalName] = useState(settings.legal_name ?? "");
  const [legalNameAr, setLegalNameAr] = useState(settings.legal_name_ar ?? "");
  const [address, setAddress] = useState(settings.address ?? "");
  const [addressAr, setAddressAr] = useState(settings.address_ar ?? "");
  const [lowStock, setLowStock] = useState(String(settings.low_stock_threshold));
  const [hero, setHero] = useState(settings.hero_image_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function uploadHero(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      setHero((await uploadImage(file, "hero")).url);
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Upload failed." });
    }
    setUploading(false);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const result = await updateStoreSettings({
      whatsapp_number: whatsapp,
      contact_phone: phone,
      contact_email: email,
      trn,
      hero_image_url: hero,
      legal_name: legalName,
      legal_name_ar: legalNameAr,
      address,
      address_ar: addressAr,
      low_stock_threshold: Number(lowStock) || 0,
    });
    setSaving(false);
    setMessage(result.ok ? { ok: true, text: "Saved. The website is updated." } : { ok: false, text: result.error });
    if (result.ok) router.refresh();
  }

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="WhatsApp number"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="971501234567"
          hint="Country code, digits only. Shows a WhatsApp button on every page. Leave empty to hide it."
        />
        <Input label="Contact phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971 4 000 0000" />
        <Input label="Contact email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input
          label="Company TRN"
          value={trn}
          onChange={(e) => setTrn(e.target.value)}
          placeholder="15 digits"
          hint="Shown in the website footer. Leave empty to hide it."
        />
      </div>

      <div className="flex flex-col gap-4 border-t border-(--color-hairline) pt-4">
        <span className="font-mono-label text-[11px] text-(--color-muted)">Tax invoice: supplier details</span>
        {!settings.trn && (
          <p className="text-sm text-red-700">
            No TRN saved yet. Invoices issued before the TRN is entered will show &ldquo;TRN not yet registered&rdquo; and cannot
            be corrected afterwards. Enter the TRN before taking real orders.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Legal name (English)" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
          <Input label="Legal name (Arabic)" dir="rtl" value={legalNameAr} onChange={(e) => setLegalNameAr(e.target.value)} />
          <Input label="Address (English)" value={address} onChange={(e) => setAddress(e.target.value)} />
          <Input label="Address (Arabic)" dir="rtl" value={addressAr} onChange={(e) => setAddressAr(e.target.value)} />
        </div>
        <p className="text-xs text-(--color-muted)">
          The supplier details, TRN, phone and email are copied onto each invoice at the moment it is issued.
        </p>
      </div>

      <div className="flex flex-col gap-3 border-t border-(--color-hairline) pt-4">
        <span className="font-mono-label text-[11px] text-(--color-muted)">Stock alerts</span>
        <div className="max-w-xs">
          <Input
            label="Low-stock level (units)"
            type="number"
            min="0"
            max="1000"
            value={lowStock}
            onChange={(e) => setLowStock(e.target.value)}
            hint="Products that track stock and have this many or fewer left show as low (an alert is emailed once). 0 units shows as out of stock."
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-mono-label text-[11px] text-(--color-muted)">Home page hero image</span>
        {hero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero} alt="" className="aspect-[16/6] w-full max-w-md border border-(--color-hairline) object-cover" />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer border border-(--color-hairline) px-3 py-2 font-mono-label text-[11px] hover:border-(--color-primary)">
            {uploading ? "Uploading..." : hero ? "Replace image" : "Upload image"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="hidden"
              disabled={uploading}
              onChange={(e) => uploadHero(e.target.files?.[0])}
            />
          </label>
          {hero && (
            <button type="button" onClick={() => setHero("")} className="font-mono-label text-[11px] text-(--color-muted) hover:text-red-600">
              Use default image
            </button>
          )}
        </div>
        <p className="text-xs text-(--color-muted)">Wide landscape photo, at least 1600px wide. Max 5 MB.</p>
      </div>

      {message && (
        <p className={`text-sm ${message.ok ? "text-(--color-primary)" : "text-red-700"}`}>{message.text}</p>
      )}
      <Button type="button" onClick={save} disabled={saving || uploading} className="w-fit">
        {saving ? "Saving..." : "Save store details"}
      </Button>
    </Card>
  );
}
