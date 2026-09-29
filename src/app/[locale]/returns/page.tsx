import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { InfoPage } from "@/components/storefront/info-page";
import { buildAlternates } from "@/lib/seo/alternates";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/returns">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Info");
  const content = t.raw("returns") as { title: string; intro: string };
  return {
    title: content.title,
    description: content.intro,
    alternates: buildAlternates(locale, "/returns"),
  };
}

export default async function Page({ params }: PageProps<"/[locale]/returns">) {
  const { locale } = await params;
  return <InfoPage page="returns" locale={locale} />;
}
