import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { MonoLabel } from "@/components/ui/mono-label";
import { StaffPanel } from "@/components/admin/settings/staff-panel";
import { StoreSettingsForm } from "@/components/admin/settings/store-settings-form";
import { getAllStaff } from "@/lib/data/admin/staff";
import { db } from "@/lib/db";
import { store_settings } from "@/lib/db/schema";
import type { StoreSettings } from "@/lib/data/settings";

export const metadata: Metadata = { title: "Settings" };

const emirates = ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"];

const keyChecks = [
  { label: "Stripe", env: "STRIPE_SECRET_KEY" },
  { label: "Tabby", env: "TABBY_SECRET_KEY" },
  { label: "Tamara", env: "TAMARA_API_TOKEN" },
  { label: "WhatsApp Business", env: "WHATSAPP_ACCESS_TOKEN" },
] as const;

export default async function AdminSettingsPage() {
  const [staff, settingsRows] = await Promise.all([
    getAllStaff(),
    db
      .select({
        whatsapp_number: store_settings.whatsapp_number,
        contact_phone: store_settings.contact_phone,
        contact_email: store_settings.contact_email,
        trn: store_settings.trn,
        hero_image_url: store_settings.hero_image_url,
        legal_name: store_settings.legal_name,
        legal_name_ar: store_settings.legal_name_ar,
        address: store_settings.address,
        address_ar: store_settings.address_ar,
      })
      .from(store_settings)
      .limit(1),
  ]);
  const settings = settingsRows[0];

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="flex flex-col gap-4">
        <MonoLabel muted={false}>Store details</MonoLabel>
        <StoreSettingsForm
          settings={
            (settings as StoreSettings | null) ?? {
              whatsapp_number: null,
              contact_phone: null,
              contact_email: null,
              trn: null,
              hero_image_url: null,
              legal_name: null,
              legal_name_ar: null,
              address: null,
              address_ar: null,
            }
          }
        />
      </section>

      <section className="flex flex-col gap-4">
        <MonoLabel muted={false}>Staff &amp; Roles</MonoLabel>
        <StaffPanel staff={staff} />
      </section>

      <section className="flex flex-col gap-4">
        <MonoLabel muted={false}>Brand</MonoLabel>
        <Card className="p-6 text-sm text-(--color-muted)">
          <p>Adhira Flowers — set via the design tokens in `src/app/globals.css`.</p>
          <p className="mt-1">Editing brand colors/fonts here isn&apos;t wired up yet — they&apos;re code-level tokens, not database-backed.</p>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <MonoLabel muted={false}>Delivery Zones</MonoLabel>
        <Card className="flex flex-wrap gap-2 p-6">
          {emirates.map((e) => (
            <span key={e} className="border border-(--color-hairline) px-3 py-1.5 text-sm">
              {e}
            </span>
          ))}
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <MonoLabel muted={false}>VAT &amp; TRN</MonoLabel>
        <Card className="p-6 text-sm text-(--color-muted)">
          Default VAT rate: 5% (set per-product, editable in Products). Company TRN is
          entered per-order at checkout and shown on invoices.
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <MonoLabel muted={false}>Payment Keys</MonoLabel>
        <Card className="divide-y divide-(--color-hairline)">
          {keyChecks.map((k) => {
            const configured = Boolean(process.env[k.env]);
            return (
              <div key={k.env} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm">{k.label}</span>
                <MonoLabel
                  muted={false}
                  className={`text-[10px] ${configured ? "text-(--color-primary)" : "text-(--color-muted)"}`}
                >
                  {configured ? "CONFIGURED" : "NOT SET"}
                </MonoLabel>
              </div>
            );
          })}
        </Card>
        <p className="text-sm text-(--color-muted)">
          Set these in <code>.env.local</code> (see <code>.env.example</code>) — never entered here.
        </p>
      </section>
    </div>
  );
}
