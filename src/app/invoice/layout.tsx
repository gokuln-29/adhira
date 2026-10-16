import type { Metadata } from "next";
import { Geist, Geist_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";
import "../globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-ibm-plex-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Tax invoice",
  robots: { index: false, follow: false },
};

// Another independent root layout (like /admin): a bilingual document page that
// must not be locale-prefixed or wrapped in the storefront chrome.
export default function InvoiceRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${ibmPlexArabic.variable} antialiased`}>
      <head>
        {/* globals.css sets a cream body background; invoices print on plain white. */}
        <style>{`@media print{html,body{background:#fff !important}}`}</style>
      </head>
      <body className="bg-neutral-200 text-black">{children}</body>
    </html>
  );
}
