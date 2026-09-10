"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getEffectivePrice } from "@/lib/pricing";
import type { CartLineItem } from "@/lib/cart/types";

const STORAGE_KEY = "fg_cart_v1";

interface CartContextValue {
  items: CartLineItem[];
  count: number;
  subtotal: number;
  vat: number;
  total: number;
  addItem: (item: Omit<CartLineItem, "qty">, qty?: number) => void;
  updateQty: (productId: string, qty: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartLineItem[]>([]);
  // State, not a ref: the write-effect below must only run once this has
  // actually committed to `true` in the same render as the hydrated `items`.
  // A ref read synchronously inside the write-effect on the same pass as
  // hydration would already read `true` while `items` was still `[]` (the
  // effect below runs after this one, in the same commit) — that raced,
  // writing an empty cart over the real one before the hydrated value ever
  // rendered. Tying both to state keeps hydration and the first write in the
  // same commit.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Deliberately reading localStorage post-mount rather than in the useState
    // initializer: the server render always has an empty cart, so hydrating
    // here (not during render) is what keeps client/server markup in sync.
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // localStorage unavailable (private mode, etc.) — cart just stays empty
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore quota/availability errors
    }
  }, [items, hydrated]);

  const value = useMemo<CartContextValue>(() => {
    let subtotal = 0;
    let vat = 0;
    for (const item of items) {
      const price = getEffectivePrice(item);
      const lineTotal = price.finalPrice * item.qty;
      subtotal += lineTotal;
      vat += (lineTotal * price.vatRate) / 100;
    }

    return {
      items,
      count: items.reduce((sum, i) => sum + i.qty, 0),
      subtotal: Math.round(subtotal * 100) / 100,
      vat: Math.round(vat * 100) / 100,
      total: Math.round((subtotal + vat) * 100) / 100,
      addItem: (item, qty = 1) => {
        setItems((prev) => {
          const existing = prev.find((i) => i.productId === item.productId);
          if (existing) {
            return prev.map((i) =>
              i.productId === item.productId ? { ...i, qty: i.qty + qty } : i,
            );
          }
          return [...prev, { ...item, qty }];
        });
      },
      updateQty: (productId, qty) => {
        setItems((prev) =>
          qty <= 0
            ? prev.filter((i) => i.productId !== productId)
            : prev.map((i) => (i.productId === productId ? { ...i, qty } : i)),
        );
      },
      removeItem: (productId) => {
        setItems((prev) => prev.filter((i) => i.productId !== productId));
      },
      clear: () => setItems([]),
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
