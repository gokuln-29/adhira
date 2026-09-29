import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { InfoPage } from "@/components/storefront/info-page";
import { buildAlternates } from "@/lib/seo/alternates";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/terms">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Info");
  const content = t.raw("terms") as { title: string; intro: string };
  return {
    title: content.title,
    description: content.intro,
    alternates: buildAlternates(locale, "/terms"),
  };
}

export default async function Page({ params }: PageProps<"/[locale]/terms">) {
  const { locale } = await params;
  return <InfoPage page="terms" locale={locale} />;
}
