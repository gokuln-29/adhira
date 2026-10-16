import { SITE_NAME, SITE_URL } from "./site";
import type { StoreSettings } from "@/lib/data/settings";

// Built from the store settings (Admin > Settings) so nothing here is a placeholder:
// the tax number, phone, email and address appear only once the owner has entered them.
// The 180 px apple-icon is the logo (Google wants a logo of at least 112 x 112 px).
const LOGO = `${SITE_URL}/apple-icon`;

export function organizationJsonLd(settings: StoreSettings) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    ...(settings.legal_name ? { legalName: settings.legal_name } : {}),
    url: SITE_URL,
    logo: LOGO,
    ...(settings.trn ? { taxID: settings.trn, vatID: settings.trn } : {}),
    ...(settings.contact_email ? { email: settings.contact_email } : {}),
    ...(settings.contact_phone ? { telephone: settings.contact_phone } : {}),
  };
}

export function localBusinessJsonLd(settings: StoreSettings, servedEmirates: string[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FloristShop",
    name: SITE_NAME,
    url: SITE_URL,
    image: LOGO,
    ...(settings.contact_phone ? { telephone: settings.contact_phone } : {}),
    ...(settings.contact_email ? { email: settings.contact_email } : {}),
    areaServed: servedEmirates.map((name) => ({ "@type": "AdministrativeArea", name })),
    address: {
      "@type": "PostalAddress",
      addressCountry: "AE",
      ...(settings.address ? { streetAddress: settings.address } : {}),
    },
  };
}
