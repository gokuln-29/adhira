import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { MonoLabel } from "@/components/ui/mono-label";
import { Card } from "@/components/ui/card";
import { getActiveOffers } from "@/lib/data/offers";
import { formatAED } from "@/lib/pricing";
import { buildAlternates } from "@/lib/seo/alternates";

export const revalidate = 300;

const DESCRIPTION = "Current offers and discount codes for office flower and plant orders.";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/offers">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  return {
    title: "Offers",
    description: DESCRIPTION,
    alternates: buildAlternates(locale, "/offers"),
    openGraph: { title: "Offers", description: DESCRIPTION },
  };
}

export default async function OffersPage({ params }: PageProps<"/[locale]/offers">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [offers, t] = await Promise.all([getActiveOffers(), getTranslations("Offers")]);

  function formatDiscount(type: string, value: number): string {
    if (type === "percent") return t("percentOff", { value });
    if (type === "flat") return t("flatOff", { value: formatAED(value) });
    return t("title");
  }

  function formatWindow(ends: string | null): string | null {
    if (!ends) return null;
    const endDate = new Date(ends).toLocaleDateString(locale === "ar" ? "ar-AE" : "en-AE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return t("validUntil", { date: endDate });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{t("title")}</h1>

          {offers.length === 0 ? (
            <p className="mt-10 text-(--color-muted)">{t("empty")}</p>
          ) : (
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {offers.map((offer) => (
                <Card key={offer.id} soft className="p-6">
                  <MonoLabel muted={false} className="text-(--color-primary)">
                    {formatDiscount(offer.type, offer.value)}
                  </MonoLabel>
                  <h2 className="mt-2 text-xl font-semibold">{offer.title}</h2>
                  {offer.code && (
                    <p className="mt-3 inline-block border border-dashed border-(--color-hairline) px-3 py-1.5 font-mono-label text-xs">
                      {t("code", { code: offer.code })}
                    </p>
                  )}
                  {formatWindow(offer.ends) && (
                    <MonoLabel as="p" className="mt-4 text-[10px]">
                      {formatWindow(offer.ends)}
                    </MonoLabel>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
