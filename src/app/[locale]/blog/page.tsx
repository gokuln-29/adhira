import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { MonoLabel } from "@/components/ui/mono-label";
import { getPublishedPosts } from "@/lib/data/blog";
import { buildAlternates } from "@/lib/seo/alternates";

export const revalidate = 300;

const DESCRIPTION = "Guides on office plant care, recurring flower programs and corporate gifting.";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/blog">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  return {
    title: "Resources",
    description: DESCRIPTION,
    alternates: buildAlternates(locale, "/blog"),
    openGraph: { title: "Resources", description: DESCRIPTION },
  };
}

export default async function BlogPage({ params }: PageProps<"/[locale]/blog">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [posts, t] = await Promise.all([getPublishedPosts(), getTranslations("Blog")]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{t("title")}</h1>

          <div className="mt-10 grid gap-x-6 gap-y-12 md:grid-cols-2">
            {posts.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`} className="group flex flex-col gap-3">
                {post.cover && (
                  <div className="relative aspect-[16/9] overflow-hidden rounded-[2px]">
                    <Image
                      src={post.cover}
                      alt={post.title}
                      fill
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
                    />
                  </div>
                )}
                {post.category && <MonoLabel>{post.category}</MonoLabel>}
                <h2 className="text-xl font-semibold group-hover:text-(--color-primary)">
                  {post.title}
                </h2>
                {post.excerpt && (
                  <p className="text-sm text-(--color-muted)">{post.excerpt}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
