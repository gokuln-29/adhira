"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { MonoLabel } from "@/components/ui/mono-label";
import { buttonVariants } from "@/components/ui/button";
import { useCart } from "@/lib/cart/cart-context";
import { formatAED, getEffectivePrice } from "@/lib/pricing";

export function CartView() {
  const t = useTranslations("Cart");
  const tPdp = useTranslations("Pdp");
  const { items, subtotal, vat, total, updateQty, removeItem } = useCart();

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>

      {items.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-4 py-16 text-center">
          <MonoLabel muted={false}>{t("empty")}</MonoLabel>
          <Link href="/shop" className={buttonVariants({ variant: "primary" })}>
            {t("continueShopping")}
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-3">
          <div className="flex flex-col divide-y divide-(--color-hairline) lg:col-span-2">
            {items.map((item) => {
              const price = getEffectivePrice(item);
              return (
                <div key={item.productId} className="flex gap-4 py-5">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[2px] bg-(--color-hairline)/40">
                    {item.image && (
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-2">
                    <div className="flex items-start justify-between gap-4">
                      <Link
                        href={`/products/${item.slug}`}
                        className="text-sm font-semibold hover:text-(--color-primary)"
                      >
                        {item.name}
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId)}
                        aria-label={t("removeItem", { name: item.name })}
                        className="font-mono-label text-[10px] text-(--color-muted) hover:text-(--color-primary)"
                      >
                        {t("remove")}
                      </button>
                    </div>

                    <MonoLabel muted={false}>{formatAED(price.finalPrice)}</MonoLabel>

                    <div className="flex items-center border border-(--color-hairline) w-fit">
                      <button
                        type="button"
                        aria-label={tPdp("decreaseQty")}
                        className="px-3 py-1.5 font-mono-label text-sm hover:text-(--color-primary)"
                        onClick={() => updateQty(item.productId, item.qty - 1)}
                      >
                        −
                      </button>
                      <span className="min-w-8 px-2 text-center font-mono-label text-sm">
                        {item.qty}
                      </span>
                      <button
                        type="button"
                        aria-label={tPdp("increaseQty")}
                        className="px-3 py-1.5 font-mono-label text-sm hover:text-(--color-primary)"
                        onClick={() => updateQty(item.productId, item.qty + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="h-fit border border-(--color-hairline) p-6">
            <MonoLabel as="p" muted={false} className="mb-4">
              {t("orderSummary")}
            </MonoLabel>
            <div className="flex flex-col gap-2 border-b border-(--color-hairline) pb-4 font-mono-label text-xs">
              <div className="flex justify-between">
                <span className="text-(--color-muted)">{t("subtotal")}</span>
                <span>{formatAED(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-(--color-muted)">{t("vat")}</span>
                <span>{formatAED(vat)}</span>
              </div>
            </div>
            <div className="flex justify-between py-4 font-mono-label text-sm">
              <span>{t("total")}</span>
              <span>{formatAED(total)}</span>
            </div>
            <Link
              href="/checkout"
              className={buttonVariants({ variant: "primary", className: "w-full" })}
            >
              {t("checkout")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
