"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { updateStoreSettings } from "@/lib/actions/admin/settings";
import type { StoreSettings } from "@/lib/data/settings";

export function StoreSettingsForm({ settings }: { settings: StoreSettings }) {
  const router = useRouter();
  const [whatsapp, setWhatsapp] = useState(settings.whatsapp_number ?? "");
  const [phone, setPhone] = useState(settings.contact_phone ?? "");
  const [email, setEmail] = useState(settings.contact_email ?? "");
  const [trn, setTrn] = useState(settings.trn ?? "");
  const [hero, setHero] = useState(settings.hero_image_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function uploadHero(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `site/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    setUploading(false);
    if (error) {
      setMessage({ ok: false, text: error.message });
      return;
    }
    setHero(supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl);
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
