import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { MonoLabel } from "@/components/ui/mono-label";
import { Card } from "@/components/ui/card";
import { ProfileForm } from "@/components/account/profile-form";
import { SignOutButton } from "@/components/account/sign-out-button";
import { getCurrentCustomer, getCurrentUser, getOrdersForCustomer } from "@/lib/data/customers";
import { formatAED } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) {
    const locale = await getLocale();
    redirect({ href: "/account/sign-in", locale });
  }

  const [profile, t] = await Promise.all([getCurrentCustomer(), getTranslations("Account")]);
  const orders = profile ? await getOrdersForCustomer(profile.id) : [];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-5xl md:text-6xl">{t("title")}</h1>
            <SignOutButton />
          </div>

          <div className="mt-8 flex flex-col gap-10">
            <ProfileForm profile={profile} />

            <div>
              <MonoLabel muted={false} className="mb-4">
                {t("ordersTitle")}
              </MonoLabel>
              {orders.length === 0 ? (
                <p className="text-sm text-(--color-muted)">{t("noOrders")}</p>
              ) : (
                <Card className="divide-y divide-(--color-hairline)">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">{order.number}</p>
                        <MonoLabel className="text-[10px]">{order.status}</MonoLabel>
                      </div>
                      <MonoLabel muted={false}>{formatAED(order.total)}</MonoLabel>
                    </div>
                  ))}
                </Card>
              )}
            </div>

            <div>
              <MonoLabel muted={false} className="mb-2">
                {t("recurringQuotesTitle")}
              </MonoLabel>
              <p className="text-sm text-(--color-muted)">{t("recurringQuotesBody")}</p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
