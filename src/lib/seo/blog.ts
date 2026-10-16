import { SITE_NAME, SITE_URL } from "./site";

// Article structured data for blog posts (Google "Article": headline, image, dates, author).
export function blogPostingJsonLd({
  locale,
  slug,
  title,
  description,
  image,
  publishedAt,
}: {
  locale: string;
  slug: string;
  title: string;
  description: string | null;
  image: string | null;
  publishedAt: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title.slice(0, 110),
    description: description ?? undefined,
    ...(image ? { image: [image] } : {}),
    ...(publishedAt ? { datePublished: publishedAt, dateModified: publishedAt } : {}),
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/${locale}/blog/${slug}` },
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL, logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-icon` } },
  };
}
