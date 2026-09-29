"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createLead, type LeadInput } from "@/lib/actions/leads";
import { EMIRATES } from "@/lib/constants/emirates";

// Canonical values stored on the `leads` row (admin CRM is English-only) —
// the displayed option text is translated, the submitted value isn't.
const frequencies = ["One-time", "Weekly", "Bi-weekly", "Monthly"] as const;

export function LeadForm({
  title,
  requirementLabel,
  requirementPlaceholder,
  submitLabel,
}: {
  title: string;
  requirementLabel?: string;
  requirementPlaceholder?: string;
  submitLabel?: string;
}) {
  const t = useTranslations("LeadForm");
  const tEmirates = useTranslations("Emirates");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const frequencyLabels: Record<(typeof frequencies)[number], string> = {
    "One-time": t("frequencyOneTime"),
    Weekly: t("frequencyWeekly"),
    "Bi-weekly": t("frequencyBiWeekly"),
    Monthly: t("frequencyMonthly"),
  };

  // onSubmit + preventDefault, not the `action` prop — see the identical
  // comment in `[locale]/checkout/page.tsx` for why: React 19 would
  // otherwise wipe the visitor's input whenever createLead resolves to
  // { ok: false } instead of throwing.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    setSubmitting(true);
    setError(null);

    const input: LeadInput = {
      contact: String(formData.get("contact") || ""),
      company: String(formData.get("company") || "") || undefined,
      email: String(formData.get("email") || "") || undefined,
      phone: String(formData.get("phone") || "") || undefined,
      emirate: (String(formData.get("emirate") || "") || undefined) as LeadInput["emirate"],
      frequency: String(formData.get("frequency") || "") || undefined,
      budget: String(formData.get("budget") || "") || undefined,
      requirement: String(formData.get("requirement") || "") || undefined,
      message: String(formData.get("message") || "") || undefined,
      website: String(formData.get("website") || ""),
    };

    const res = await createLead(input);
    setSubmitting(false);

    if (res.ok) {
      setResult("success");
    } else {
      setResult("error");
      setError(res.error);
    }
  }

  if (result === "success") {
    return (
      <div className="border border-(--color-hairline) p-8 text-center">
        <p className="font-mono-label text-sm text-(--color-primary)">{t("successTitle")}</p>
        <p className="mt-2 text-(--color-muted)">{t("successBody")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 border border-(--color-hairline) p-6">
      <h3 className="text-xl font-semibold">{title}</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input name="contact" label={t("yourName")} required />
        <Input name="company" label={t("company")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input name="email" type="email" label={t("email")} />
        <Input name="phone" type="tel" label={t("phone")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Select name="emirate" label={t("emirate")}>
          <option value="">{t("select")}</option>
          {EMIRATES.map((e) => (
            <option key={e} value={e}>
              {tEmirates(e)}
            </option>
          ))}
        </Select>
        <Select name="frequency" label={t("frequency")}>
          <option value="">{t("select")}</option>
          {frequencies.map((f) => (
            <option key={f} value={f}>
              {frequencyLabels[f]}
            </option>
          ))}
        </Select>
        <Input name="budget" label={t("budget")} />
      </div>
      <Textarea
        name="requirement"
        label={requirementLabel}
        placeholder={requirementPlaceholder}
        rows={3}
      />
      <Textarea name="message" label={t("anythingElse")} rows={2} />

      {/* Honeypot: hidden from people and screen readers, bots fill it in. */}
      <div aria-hidden="true" className="absolute -start-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? t("sending") : submitLabel}
      </Button>
    </form>
  );
}
