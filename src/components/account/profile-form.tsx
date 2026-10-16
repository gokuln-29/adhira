"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/ui/mono-label";
import { updateCustomerProfile, type CustomerProfileInput } from "@/lib/actions/customers";
import type { CustomerProfile } from "@/lib/data/customers";

export function ProfileForm({ profile }: { profile: CustomerProfile | null }) {
  const t = useTranslations("Account");
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // onSubmit + preventDefault, not the `action` prop — see the identical
  // comment in `[locale]/checkout/page.tsx` for why: React 19 would
  // otherwise wipe every field whenever the save resolves to
  // { ok: false } instead of throwing.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    setSaving(true);
    setError(null);
    setSaved(false);

    const input: CustomerProfileInput = {
      name: String(formData.get("name") || ""),
      phone: String(formData.get("phone") || "") || undefined,
      company: String(formData.get("company") || "") || undefined,
      trn: String(formData.get("trn") || "") || undefined,
    };

    const result = await updateCustomerProfile(input);

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 border border-(--color-hairline) p-6">
      <MonoLabel muted={false}>{profile ? t("profileTitle") : t("completeProfileTitle")}</MonoLabel>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input name="name" label={t("fullName")} required defaultValue={profile?.name} />
        <Input name="phone" label={t("phone")} defaultValue={profile?.phone ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input name="company" label={t("companyOptional")} defaultValue={profile?.company ?? ""} />
        <Input name="trn" label={t("trnOptional")} defaultValue={profile?.trn ?? ""} />
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {saved && <p className="text-sm text-(--color-primary)">{t("saved")}</p>}
      <Button type="submit" disabled={saving} className="w-fit">
        {saving ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
