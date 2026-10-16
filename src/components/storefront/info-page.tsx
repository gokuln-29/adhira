import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";

export type InfoKey = "about" | "delivery" | "returns" | "privacy" | "terms";

interface InfoContent {
  title: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
}

// Shared layout for the plain-text pages (about, delivery, returns, privacy,
// terms). The wording lives in the message files so it is editable per language.
export async function InfoPage({ page, locale }: { page: InfoKey; locale: string }) {
  setRequestLocale(locale);
  const [t, b] = await Promise.all([getTranslations("Info"), getTranslations("Breadcrumbs")]);
  const content = t.raw(page) as InfoContent;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <Breadcrumbs items={[{ label: b("home"), href: "/" }, { label: content.title }]} />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-6 py-16 md:py-24">
          <h1 className="font-display text-4xl md:text-6xl">{content.title}</h1>
          <p className="mt-5 text-lg text-(--color-muted)">{content.intro}</p>
          <div className="mt-14 flex flex-col gap-10">
            {content.sections.map((section) => (
              <section key={section.heading} className="border-t border-(--color-hairline) pt-8">
                <h2 className="text-xl font-semibold">{section.heading}</h2>
                <div className="mt-3 flex flex-col gap-3 text-(--color-muted)">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
