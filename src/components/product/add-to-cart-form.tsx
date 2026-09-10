"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useCart } from "@/lib/cart/cart-context";
import { Button } from "@/components/ui/button";
import type { CartLineItem } from "@/lib/cart/types";

export function AddToCartForm({
  product,
}: {
  product: Omit<CartLineItem, "qty">;
}) {
  const t = useTranslations("Pdp");
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="font-mono-label text-[11px] text-(--color-muted)">{t("qty")}</span>
        <div className="flex items-center border border-(--color-hairline)">
          <button
            type="button"
            aria-label={t("decreaseQty")}
            className="px-3 py-2 font-mono-label text-sm hover:text-(--color-primary)"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
          >
            −
          </button>
          <span className="min-w-8 px-2 text-center font-mono-label text-sm">{qty}</span>
          <button
            type="button"
            aria-label={t("increaseQty")}
            className="px-3 py-2 font-mono-label text-sm hover:text-(--color-primary)"
            onClick={() => setQty((q) => q + 1)}
          >
            +
          </button>
        </div>
      </div>

      <Button
        type="button"
        size="lg"
        onClick={() => {
          addItem(product, qty);
          setAdded(true);
          setTimeout(() => setAdded(false), 2000);
        }}
      >
        {added ? t("added") : t("addToCart")}
      </Button>
    </div>
  );
}
