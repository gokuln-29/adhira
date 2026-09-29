import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CartView } from "@/components/storefront/cart-view";
import { buildAlternates } from "@/lib/seo/alternates";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/cart">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  return {
    title: "Cart",
    robots: { index: false, follow: false },
    alternates: buildAlternates(locale, "/cart"),
  };
}

export default async function CartPage({
  params,
}: PageProps<"/[locale]/cart">) {
  // Enables static rendering (the page itself is client-side state only).
  setRequestLocale((await params).locale);
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <CartView />
      </main>
      <Footer />
    </div>
  );
}
