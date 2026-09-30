import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { MonoLabel } from "@/components/ui/mono-label";
import { Card } from "@/components/ui/card";
import { LeadForm } from "@/components/storefront/lead-form";
import { buildAlternates } from "@/lib/seo/alternates";

const DESCRIPTION =
  "Plant fit-outs and recurring flower setups for offices across the UAE — reception, meeting rooms and breakout areas.";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/setups">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  return {
    title: "Indoor Flower Arrangements & Setups",
    description: DESCRIPTION,
    alternates: buildAlternates(locale, "/setups"),
    openGraph: { title: "Indoor Flower Arrangements & Setups", description: DESCRIPTION },
  };
}

export default async function SetupsPage({ params }: PageProps<"/[locale]/setups">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Setups");
  const whatWeSetUp = t.raw("whatWeSetUp") as { title: string; body: string }[];
  const packages = t.raw("packages") as { name: string; detail: string }[];
  const steps = t.raw("steps") as { step: string; title: string; body: string }[];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 py-20">
          <MonoLabel muted={false} className="text-(--color-primary)">
            {t("eyebrow")}
          </MonoLabel>
          <h1 className="mt-4 max-w-3xl font-display text-5xl md:text-6xl">
            {t("title")}
          </h1>
          <p className="mt-4 max-w-xl text-(--color-muted)">{t("subtitle")}</p>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <h2 className="mb-10 font-display text-3xl md:text-4xl">{t("whatWeSetUpTitle")}</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {whatWeSetUp.map((item) => (
              <Card key={item.title} className="p-6">
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-(--color-muted)">{item.body}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <h2 className="mb-10 font-display text-3xl md:text-4xl">{t("packagesTitle")}</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {packages.map((pkg) => (
              <Card key={pkg.name} soft className="p-6">
                <MonoLabel muted={false}>{pkg.name}</MonoLabel>
                <p className="mt-2 text-sm text-(--color-muted)">{pkg.detail}</p>
              </Card>
            ))}
          </div>
          <p className="mt-4 text-sm text-(--color-muted)">{t("packagesNote")}</p>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <h2 className="mb-10 font-display text-3xl md:text-4xl">{t("howItWorksTitle")}</h2>
          <div className="grid gap-6 md:grid-cols-4">
            {steps.map((s) => (
              <div key={s.step}>
                <MonoLabel muted={false} className="text-(--color-primary)">
                  {s.step}
                </MonoLabel>
                <h3 className="mt-2 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-(--color-muted)">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <Card soft className="p-8">
            <h2 className="font-display text-3xl md:text-4xl">{t("recurringTitle")}</h2>
            <p className="mt-3 max-w-2xl text-(--color-muted)">{t("recurringBody")}</p>
          </Card>
        </section>

        <section id="request-setup" className="mx-auto max-w-3xl px-6 pb-24">
          <h2 className="mb-10 font-display text-3xl md:text-4xl">{t("requestTitle")}</h2>
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
