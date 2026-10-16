import type { Metadata } from "next";
import { Cormorant_Garamond, Geist, Geist_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { DeliveryRulesProvider } from "@/lib/delivery/context";
import { getDeliveryRules } from "@/lib/data/delivery";
import { getStoreSettings } from "@/lib/data/settings";
import { CartProvider } from "@/lib/cart/cart-context";
import { SITE_NAME, SITE_URL } from "@/lib/seo/site";
import { organizationJsonLd, localBusinessJsonLd } from "@/lib/seo/organization";
import { JsonLd } from "@/components/seo/json-ld";
import { WhatsAppButton } from "@/components/layout/whatsapp-button";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Elegant serif for large headlines only (home page). Body text stays Geist.
const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600"],
});

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-ibm-plex-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Adhira Flowers | Corporate, Events & Celebrations — UAE",
    template: "%s | Adhira Flowers",
  },
  description:
    "Fresh flower arrangements, corporate gifting, event florals and plant setups for offices, weddings, birthdays and celebrations across Dubai, Abu Dhabi and Sharjah.",
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enables static rendering: without this, next-intl resolves the locale
  // via request headers on every page under this layout, which forces
  // every one of them to render dynamically regardless of `revalidate`.
  setRequestLocale(locale);

  const [messages, deliveryRules, storeSettings] = await Promise.all([getMessages(), getDeliveryRules(), getStoreSettings()]);
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} ${ibmPlexArabic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-(--color-canvas) text-(--color-ink)">
        <JsonLd data={organizationJsonLd(storeSettings)} />
        <JsonLd data={localBusinessJsonLd(storeSettings, deliveryRules.zones.filter((z) => z.enabled).map((z) => z.emirate))} />
        <NextIntlClientProvider messages={messages}>
          <DeliveryRulesProvider rules={deliveryRules}>
            <CartProvider>{children}</CartProvider>
          </DeliveryRulesProvider>
          <WhatsAppButton />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
