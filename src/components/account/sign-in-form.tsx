"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { requestSignInCode, verifySignInCode } from "@/lib/actions/auth";

export function SignInForm() {
  const t = useTranslations("SignIn");
  const locale = useLocale() as "en" | "ar";
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await requestSignInCode(email, locale);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await verifySignInCode(email, code);
    if (!res.ok) {
      setBusy(false);
      return setError(res.error);
    }
    router.push("/account");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md px-6 py-24">
      <h1 className="font-display text-5xl md:text-6xl">{t("title")}</h1>
      <p className="mt-2 text-(--color-muted)">{t("subtitle")}</p>

      {step === "code" ? (
        <form onSubmit={verify} className="mt-8 flex flex-col gap-4">
          <p className="text-sm text-(--color-muted)">{t("checkEmailBody", { email })}</p>
          <Input
            label={t("code")}
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <Button type="submit" disabled={busy || code.length !== 6}>
            {busy ? t("verifying") : t("verify")}
          </Button>
          <button
            type="button"
            className="text-start text-sm text-(--color-muted) underline"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
          >
            {t("useDifferentEmail")}
          </button>
        </form>
      ) : (
        <form onSubmit={sendCode} className="mt-8 flex flex-col gap-4">
          <Input
            type="email"
            label={t("email")}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? t("sending") : t("sendLink")}
          </Button>
        </form>
      )}
    </div>
  );
}
