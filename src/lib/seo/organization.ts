import { SITE_NAME, SITE_URL } from "./site";

// TRN mirrors the placeholder in Footer.tsx — replace both together once a
// real company TRN is set.
const TRN = "100000000000003";

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.ico`,
    taxID: TRN,
  };
}

export function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FloristShop",
    name: SITE_NAME,
    url: SITE_URL,
    areaServed: [
      "Dubai",
      "Abu Dhabi",
      "Sharjah",
      "Ajman",
      "Ras Al Khaimah",
      "Fujairah",
      "Umm Al Quwain",
    ].map((name) => ({ "@type": "AdministrativeArea", name })),
    address: {
      "@type": "PostalAddress",
      addressCountry: "AE",
    },
    priceRange: "AED",
  };
}
