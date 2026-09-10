import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { MonoLabel } from "@/components/ui/mono-label";
import { Card } from "@/components/ui/card";
import { LeadForm } from "@/components/storefront/lead-form";
import { JsonLd } from "@/components/seo/json-ld";
import { buildAlternates } from "@/lib/seo/alternates";

const DESCRIPTION =
  "Bulk flower orders, recurring office arrangements and corporate gifting for businesses in Dubai, Abu Dhabi and Sharjah.";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/corporate">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  return {
    title: "Corporate Flowers & Plants",
    description: DESCRIPTION,
    alternates: buildAlternates(locale, "/corporate"),
    openGraph: { title: "Corporate Flowers & Plants", description: DESCRIPTION },
  };
}

export default async function CorporatePage({ params }: PageProps<"/[locale]/corporate">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Corporate");
  const valueProps = t.raw("valueProps") as { title: string; body: string }[];
  const faqs = t.raw("faqs") as { q: string; a: string }[];

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };

  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd data={faqJsonLd} />
      <Header />

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 py-20">
          <MonoLabel muted={false} className="text-(--color-primary)">
            {t("eyebrow")}
          </MonoLabel>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight md:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-4 max-w-xl text-(--color-muted)">{t("subtitle")}</p>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          {/* Visually hidden — keeps heading order sequential ahead of the
              h3 cards below without changing the design. */}
          <h2 className="sr-only">{t("eyebrow")}</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {valueProps.map((v) => (
              <Card key={v.title} className="p-6">
                <h3 className="font-semibold">{v.title}</h3>
                <p className="mt-2 text-sm text-(--color-muted)">{v.body}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <h2 className="mb-8 text-2xl font-semibold">{t("faqTitle")}</h2>
          <div className="flex flex-col divide-y divide-(--color-hairline) border-y border-(--color-hairline)">
            {faqs.map((faq) => (
              <div key={faq.q} className="py-5">
                <h3 className="font-semibold">{faq.q}</h3>
                <p className="mt-1 text-sm text-(--color-muted)">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="quote" className="mx-auto max-w-3xl px-6 pb-24">
          <h2 className="mb-8 text-2xl font-semibold">{t("quoteTitle")}</h2>
          <LeadForm
            title={t("formTitle")}
            requirementLabel={t("requirementLabel")}
            requirementPlaceholder={t("requirementPlaceholder")}
            submitLabel={t("submitLabel")}
          />
        </section>
      </main>

      <Footer />
    </div>
  );
}
