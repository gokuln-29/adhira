import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Admin | Adhira Flowers",
    template: "%s | Adhira Flowers Admin",
  },
  robots: { index: false, follow: false },
};

// /admin is a second, independent root layout (English-only, no next-intl
// provider) — Next.js supports multiple root layouts as sibling top-level
// segments as long as there's no shared app/layout.tsx also rendering <html>.
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-(--color-canvas) text-(--color-ink)">{children}</body>
    </html>
  );
}
