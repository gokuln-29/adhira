import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CartView } from "@/components/storefront/cart-view";
import { buildAlternates } from "@/lib/seo/alternates";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/cart">): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Cart",
    robots: { index: false, follow: false },
    alternates: buildAlternates(locale, "/cart"),
  };
}

export default function CartPage() {
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
