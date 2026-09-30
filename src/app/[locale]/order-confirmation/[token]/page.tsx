import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { MonoLabel } from "@/components/ui/mono-label";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { ClearCartOnMount } from "@/components/product/clear-cart-on-mount";
import { getOrderByToken } from "@/lib/data/orders";
import { formatAED } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Order Confirmed",
  robots: { index: false, follow: false },
};

export default async function OrderConfirmationPage({
  params,
}: PageProps<"/[locale]/order-confirmation/[token]">) {
  const { token } = await params;
  const order = await getOrderByToken(token);
  if (!order) notFound();

  const [t, tEmirates] = await Promise.all([
    getTranslations("OrderConfirmation"),
    getTranslations("Emirates"),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <ClearCartOnMount />
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-6 py-16">
          <MonoLabel muted={false} className="text-(--color-primary)">
            {t("eyebrow")}
          </MonoLabel>
          <h1 className=" font-display text-5xl md:text-6xl">
            {t("title", { number: order.number })}
          </h1>
          <p className="mt-2 text-(--color-muted)">
            {t("body")}
            {order.emirate &&
              ` ${t("deliveringTo", { emirate: tEmirates(order.emirate) })}`}
          </p>

          <div className="mt-8 border border-(--color-hairline) p-6">
            <div className="flex flex-col divide-y divide-(--color-hairline)">
              {order.order_items.map((item, i) => (
                <div key={i} className="flex justify-between py-3 text-sm">
                  <span>
                    {item.name} <span className="text-(--color-muted)">×{item.qty}</span>
                  </span>
                  <MonoLabel muted={false}>{formatAED(item.line_total)}</MonoLabel>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-2 border-t border-(--color-hairline) pt-4 font-mono-label text-xs">
              <div className="flex justify-between">
                <span className="text-(--color-muted)">{t("subtotal")}</span>
                <span>{formatAED(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-(--color-muted)">{t("vat")}</span>
                <span>{formatAED(order.vat)}</span>
              </div>
              {order.deposit_total > 0 && (
                <div className="flex justify-between">
                  <span className="text-(--color-muted)">{t("deposit")}</span>
                  <span>{formatAED(order.deposit_total)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 text-sm">
                <span>{t("total")}</span>
                <span>{formatAED(order.total)}</span>
              </div>
            </div>
          </div>

          <Link href="/shop" className={buttonVariants({ variant: "primary", className: "mt-8" })}>
            {t("continueShopping")}
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
