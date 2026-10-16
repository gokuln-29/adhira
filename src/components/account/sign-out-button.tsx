"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { signOutCustomer } from "@/lib/actions/auth";

export function SignOutButton() {
  const t = useTranslations("Account");
  const router = useRouter();

  return (
    <button
      type="button"
      className="font-mono-label text-[11px] text-(--color-muted) hover:text-(--color-primary)"
      onClick={async () => {
        await signOutCustomer();
        router.push("/account/sign-in");
        router.refresh();
      }}
    >
      {t("signOut")}
    </button>
  );
}
