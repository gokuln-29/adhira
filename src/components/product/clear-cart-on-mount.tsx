"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart/cart-context";

// Rendered only on the order-confirmation page: clearing here (not at
// checkout submit) means a cancelled/abandoned Stripe Checkout leaves the
// cart intact when the buyer lands back on /checkout.
export function ClearCartOnMount() {
  const { clear } = useCart();

  useEffect(() => {
    clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clear once on mount only
  }, []);

  return null;
}
