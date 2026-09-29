"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useCart } from "@/lib/cart/cart-context";
import { Button } from "@/components/ui/button";
import { effectiveMinQty, formatAED, priceLine, rentalMonthChoices } from "@/lib/pricing";
import type { CartLineItem } from "@/lib/cart/types";

type FormProduct = Omit<CartLineItem, "qty" | "vessel" | "months">;

export function AddToCartForm({ product }: { product: FormProduct }) {
  const t = useTranslations("Pdp");
  const { addItem } = useCart();

  const isRental = product.is_rental && (product.rental_monthly_price ?? 0) > 0;
  const monthOptions = rentalMonthChoices(product.rental_min_months);

  const [months, setMonths] = useState(isRental ? product.rental_min_months : 1);
  const [vessel, setVessel] = useState(false);
  const minQty = effectiveMinQty(product, months);
  const [qtyRaw, setQty] = useState(() => effectiveMinQty(product));
  const qty = Math.max(qtyRaw, product.min_order_qty);
  const [added, setAdded] = useState(false);

  const line = priceLine(product, { qty, vessel, months });
  const belowValue = line.problems.some((p) => p.code === "min_value");

  return (
    <div className="flex flex-col gap-5">
      {(product.min_order_qty > 1 || product.min_order_value > 0 || isRental) && (
        <ul className="flex flex-col gap-1 border border-(--color-hairline) bg-(--color-hairline)/20 p-3">
          {product.min_order_qty > 1 && (
            <li className="text-sm">{t("minQty", { qty: product.min_order_qty })}</li>
          )}
          {product.min_order_value > 0 && (
            <li className="text-sm">{t("minValue", { value: formatAED(product.min_order_value) })}</li>
          )}
          {isRental && (
            <li className="text-sm">{t("minMonths", { months: product.rental_min_months })}</li>
          )}
        </ul>
      )}

      {isRental && (
        <label className="flex flex-col gap-1.5">
          <span className="font-mono-label text-[11px] text-(--color-muted)">{t("rentalLength")}</span>
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="w-fit border border-(--color-hairline) bg-(--color-surface) px-3 py-2 text-sm"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {t("monthsOption", { months: m })}
              </option>
            ))}
          </select>
        </label>
      )}

      {product.allows_vessel && (
        <label className="flex cursor-pointer items-start gap-3 border border-(--color-hairline) p-3">
          <input
            type="checkbox"
            checked={vessel}
            onChange={(e) => setVessel(e.target.checked)}
            className="mt-1 h-4 w-4 accent-(--color-primary)"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">{t("vesselOption")}</span>
            <span className="text-sm text-(--color-muted)">
              {product.vessel_price > 0
                ? t("vesselPrice", { price: formatAED(product.vessel_price) })
                : t("vesselFree")}
              {product.vessel_deposit > 0 &&
                ` · ${t("vesselDeposit", { deposit: formatAED(product.vessel_deposit) })}`}
            </span>
          </span>
        </label>
      )}

      <div className="flex items-center gap-3">
        <span className="font-mono-label text-[11px] text-(--color-muted)">{t("qty")}</span>
        <div className="flex items-center border border-(--color-hairline)">
          <button
            type="button"
            aria-label={t("decreaseQty")}
            disabled={qty <= product.min_order_qty}
            className="px-3 py-2 font-mono-label text-sm hover:text-(--color-primary) disabled:opacity-30"
            onClick={() => setQty(Math.max(product.min_order_qty, qty - 1))}
          >
            −
          </button>
          <span className="min-w-8 px-2 text-center font-mono-label text-sm">{qty}</span>
          <button
            type="button"
            aria-label={t("increaseQty")}
            className="px-3 py-2 font-mono-label text-sm hover:text-(--color-primary)"
            onClick={() => setQty(qty + 1)}
          >
            +
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1 font-mono-label text-xs">
        <div className="flex justify-between">
          <span className="text-(--color-muted)">{t("lineTotal")}</span>
          <span>{formatAED(line.lineFils / 100)}</span>
        </div>
        {line.depositFils > 0 && (
          <div className="flex justify-between">
            <span className="text-(--color-muted)">{t("refundableDeposit")}</span>
            <span>{formatAED(line.depositFils / 100)}</span>
          </div>
        )}
      </div>

      {belowValue && (
        <p role="status" className="text-sm text-red-700">
          {t("belowMinValue", { qty: minQty })}{" "}
          <button type="button" className="underline" onClick={() => setQty(minQty)}>
            {t("setToMinimum", { qty: minQty })}
          </button>
        </p>
      )}

      <Button
        type="button"
        size="lg"
        disabled={belowValue}
        onClick={() => {
          addItem({ ...product, vessel, months }, qty);
          setAdded(true);
          setTimeout(() => setAdded(false), 2000);
        }}
      >
        {added ? t("added") : t("addToCart")}
      </Button>
    </div>
  );
}
