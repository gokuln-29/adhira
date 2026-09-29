import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { LeadForm } from "@/components/storefront/lead-form";
import { getStoreSettings } from "@/lib/data/settings";
import { buildAlternates } from "@/lib/seo/alternates";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Contact");
  return {
    title: t("title"),
    description: t("intro"),
    alternates: buildAlternates(locale, "/contact"),
  };
}

export default async function ContactPage({ params }: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, b, settings] = await Promise.all([
    getTranslations("Contact"),
    getTranslations("Breadcrumbs"),
    getStoreSettings(),
  ]);

  const details = [
    settings.contact_phone && {
      label: t("phone"),
      value: settings.contact_phone,
      href: `tel:${settings.contact_phone.replace(/[^+\d]/g, "")}`,
    },
    settings.contact_email && {
      label: t("email"),
      value: settings.contact_email,
      href: `mailto:${settings.contact_email}`,
    },
    settings.whatsapp_number && {
      label: t("whatsapp"),
      value: t("chat"),
      href: `https://wa.me/${settings.whatsapp_number}`,
    },
  ].filter((d): d is { label: string; value: string; href: string } => !!d);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <Breadcrumbs items={[{ label: b("home"), href: "/" }, { label: t("title") }]} />
      <main className="flex-1">
        <div className="mx-auto grid max-w-6xl gap-14 px-6 py-16 md:py-24 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <h1 className="font-display text-4xl md:text-6xl">{t("title")}</h1>
            <p className="mt-5 text-lg text-(--color-muted)">{t("intro")}</p>
            {details.length > 0 && (
              <dl className="mt-10 flex flex-col gap-6">
                {details.map((d) => (
                  <div key={d.label} className="border-t border-(--color-hairline) pt-4">
                    <dt className="font-mono-label text-[11px] text-(--color-muted)">{d.label}</dt>
                    <dd className="mt-1 text-lg">
                      <a
                        href={d.href}
                        {...(d.href.startsWith("https") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        className="hover:text-(--color-primary)"
                      >
                        {d.value}
                      </a>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <div className="lg:col-span-3">
            <LeadForm
              title={t("formTitle")}
              requirementLabel={t("requirementLabel")}
              requirementPlaceholder={t("requirementPlaceholder")}
              submitLabel={t("submit")}
            />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
