import type { Metadata } from "next";
import Image from "next/image";
import { notFoundOrRedirect } from "@/lib/redirects-page";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { MonoLabel } from "@/components/ui/mono-label";
import { getPostBySlug, getPublishedPostSlugs } from "@/lib/data/blog";
import { routing } from "@/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";

export const revalidate = 300;

export async function generateStaticParams() {
  const slugs = await getPublishedPostSlugs();
  return routing.locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug: slug })));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/blog/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const post = await getPostBySlug(slug);
  if (!post) return {};

  const title = post.seo_title || post.title;
  const description = post.seo_description || post.excerpt || undefined;

  return {
    title,
    description,
    alternates: buildAlternates(locale, `/blog/${slug}`),
    openGraph: {
      title,
      description,
      type: "article",
      images: post.cover ? [post.cover] : undefined,
    },
  };
}

export default async function BlogPostPage({
  params,
}: PageProps<"/[locale]/blog/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const post = await getPostBySlug(slug);
  if (!post) return notFoundOrRedirect("post", slug, (s) => `/${locale}/blog/${s}`);

  const [b, blog] = await Promise.all([
    getTranslations("Breadcrumbs"),
    getTranslations("Blog"),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <Breadcrumbs
        items={[
          { label: b("home"), href: "/" },
          { label: blog("title"), href: "/blog" },
          { label: post.title },
        ]}
      />

      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-6 py-10">
          {post.category && <MonoLabel muted={false}>{post.category}</MonoLabel>}
          <h1 className="mt-4 max-w-3xl font-display text-5xl md:text-6xl">{post.title}</h1>
          {post.published_at && (
            <MonoLabel as="p" className="mt-3 text-[11px]">
              {new Date(post.published_at).toLocaleDateString(locale === "ar" ? "ar-AE" : "en-AE", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </MonoLabel>
          )}

          {post.cover && (
            <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-[2px]">
              <Image
                src={post.cover}
                alt={post.title}
                fill
                priority
                sizes="(min-width: 768px) 768px, 100vw"
                className="object-cover"
              />
            </div>
          )}

          {post.body && (
            <div className="mt-8 whitespace-pre-line text-(--color-ink)">{post.body}</div>
          )}
        </article>
      </main>

      <Footer />
    </div>
  );
}
