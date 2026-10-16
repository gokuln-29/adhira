import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { MonoLabel } from "@/components/ui/mono-label";
import { JsonLd } from "@/components/seo/json-ld";
import { SITE_URL } from "@/lib/seo/site";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const locale = useLocale();

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `${SITE_URL}/${locale}${item.href}` } : {}),
    })),
  };

  return (
    <nav aria-label="Breadcrumb" className="mx-auto w-full max-w-7xl px-6 pt-8">
      <JsonLd data={breadcrumbJsonLd} />
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-2">
            {i > 0 && <MonoLabel className="text-[10px]">/</MonoLabel>}
            {item.href ? (
              <Link
                href={item.href}
                className="inline-flex min-h-8 items-center font-mono-label text-[11px] text-(--color-muted) hover:text-(--color-primary)"
              >
                {item.label}
              </Link>
            ) : (
              <MonoLabel as="span" muted={false} className="text-[11px]">
                {item.label}
              </MonoLabel>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
