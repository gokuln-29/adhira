import { routing } from "@/i18n/routing";
import { SITE_URL } from "./site";

/**
 * Canonical + hreflang for a page, given the current locale and the
 * locale-independent pathname (e.g. "" for home, "/shop", "/products/foo").
 */
export function buildAlternates(locale: string, pathname: string) {
  const languages: Record<string, string> = {};
  for (const loc of routing.locales) {
    languages[loc] = `${SITE_URL}/${loc}${pathname}`;
  }
  languages["x-default"] = `${SITE_URL}/${routing.defaultLocale}${pathname}`;

  return {
    canonical: `${SITE_URL}/${locale}${pathname}`,
    languages,
  };
}
