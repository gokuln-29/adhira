"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const t = useTranslations("Account");
  const router = useRouter();

  return (
    <button
      type="button"
      className="font-mono-label text-[11px] text-(--color-muted) hover:text-(--color-primary)"
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/account/sign-in");
        router.refresh();
      }}
    >
      {t("signOut")}
    </button>
  );
}
