"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buttonVariants, Button } from "@/components/ui/button";

// Shown if a page crashes at runtime. Details go to the server logs, never the visitor.
export default function LocaleError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("ErrorPage");

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6 py-24">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <h1 className="font-display text-4xl">{t("title")}</h1>
        <p className="text-(--color-muted)">{t("body")}</p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Button type="button" onClick={reset}>
            {t("retry")}
          </Button>
          <Link href="/" className={buttonVariants({ variant: "secondary" })}>
            {t("home")}
          </Link>
        </div>
      </div>
    </main>
  );
}
