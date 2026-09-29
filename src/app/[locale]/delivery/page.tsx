import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { InfoPage } from "@/components/storefront/info-page";
import { buildAlternates } from "@/lib/seo/alternates";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/delivery">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Info");
  const content = t.raw("delivery") as { title: string; intro: string };
  return {
    title: content.title,
    description: content.intro,
    alternates: buildAlternates(locale, "/delivery"),
  };
}

export default async function Page({ params }: PageProps<"/[locale]/delivery">) {
  const { locale } = await params;
  return <InfoPage page="delivery" locale={locale} />;
}
