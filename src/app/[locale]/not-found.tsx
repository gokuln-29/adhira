import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center px-6 py-24">
        <div className="flex max-w-md flex-col items-center gap-5 text-center">
          <span className="font-display text-7xl text-(--color-primary)/40">404</span>
          <h1 className="font-display text-4xl">{t("title")}</h1>
          <p className="text-(--color-muted)">{t("body")}</p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link href="/" className={buttonVariants({ variant: "primary" })}>
              {t("home")}
            </Link>
            <Link href="/shop" className={buttonVariants({ variant: "secondary" })}>
              {t("shop")}
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
