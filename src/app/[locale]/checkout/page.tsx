import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CheckoutView } from "@/components/storefront/checkout-view";
import { buildAlternates } from "@/lib/seo/alternates";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/checkout">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  return {
    title: "Checkout",
    robots: { index: false, follow: false },
    alternates: buildAlternates(locale, "/checkout"),
  };
}

export default async function CheckoutPage({
  params,
}: PageProps<"/[locale]/checkout">) {
  // Enables static rendering (the page itself is client-side state only).
  setRequestLocale((await params).locale);
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <CheckoutView />
      </main>
      <Footer />
    </div>
  );
}
