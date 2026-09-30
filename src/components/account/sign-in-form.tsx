"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/ui/mono-label";
import { createClient } from "@/lib/supabase/client";

export function SignInForm() {
  const t = useTranslations("SignIn");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (signInError) {
      setStatus("error");
      setError(signInError.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <div className="mx-auto max-w-md px-6 py-24">
      <h1 className="font-display text-5xl md:text-6xl">{t("title")}</h1>
      <p className="mt-2 text-(--color-muted)">{t("subtitle")}</p>

      {status === "sent" ? (
        <div className="mt-8 border border-(--color-hairline) p-6">
          <MonoLabel muted={false} className="text-(--color-primary)">
            {t("checkEmailTitle")}
          </MonoLabel>
          <p className="mt-2 text-sm text-(--color-muted)">
            {t("checkEmailBody", { email })}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <Input
            type="email"
            label={t("email")}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <Button type="submit" disabled={status === "sending"}>
            {status === "sending" ? t("sending") : t("sendLink")}
          </Button>
        </form>
      )}
    </div>
  );
}
