"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_RULES, priceLine, type LineProblem } from "@/lib/pricing";
import type { CartLineItem } from "@/lib/cart/types";

const STORAGE_KEY = "fg_cart_v1";

export interface CartLineTotals {
  goods: number;
  vessel: number;
  vat: number;
  deposit: number;
  problems: LineProblem[];
}

interface CartContextValue {
  items: CartLineItem[];
  count: number;
  subtotal: number;
  vat: number;
  /** Refundable deposits (glass vessels, rentals). Not subject to VAT. */
  deposit: number;
  total: number;
  /** Per-line breakdown, keyed by productId. */
  lines: Record<string, CartLineTotals>;
  /** True when every line meets its minimum order rules. */
  valid: boolean;
  addItem: (
    item: Omit<CartLineItem, "qty" | "vessel" | "months"> & Partial<Pick<CartLineItem, "vessel" | "months">>,
    qty?: number,
  ) => void;
  updateQty: (productId: string, qty: number) => void;
  setVessel: (productId: string, vessel: boolean) => void;
  setMonths: (productId: string, months: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

// Carts saved before product rules existed lack the new fields.
function normalizeItem(item: Partial<CartLineItem>): CartLineItem {
  const merged = { ...DEFAULT_RULES, vessel: false, months: 1, qty: 1, ...item } as CartLineItem;
  merged.qty = Math.max(1, Math.floor(merged.qty) || 1);
  return merged;
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
      if (raw) setItems((JSON.parse(raw) as Partial<CartLineItem>[]).map(normalizeItem));
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
    let subtotalFils = 0;
    let vatFils = 0;
    let depositFils = 0;
    let valid = true;
    const lines: Record<string, CartLineTotals> = {};
    for (const item of items) {
      const line = priceLine(item, item);
      subtotalFils += line.lineFils;
      vatFils += line.vatFils;
      depositFils += line.depositFils;
      if (line.problems.length > 0) valid = false;
      lines[item.productId] = {
        goods: line.goodsFils / 100,
        vessel: line.vesselFils / 100,
        vat: line.vatFils / 100,
        deposit: line.depositFils / 100,
        problems: line.problems,
      };
    }

    const patch = (productId: string, change: Partial<CartLineItem>) =>
      setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, ...change } : i)));

    return {
      items,
      count: items.reduce((sum, i) => sum + i.qty, 0),
      subtotal: subtotalFils / 100,
      vat: vatFils / 100,
      deposit: depositFils / 100,
      total: (subtotalFils + vatFils + depositFils) / 100,
      lines,
      valid,
      addItem: (item, qty = 1) => {
        setItems((prev) => {
          const existing = prev.find((i) => i.productId === item.productId);
          if (existing) {
            return prev.map((i) =>
              i.productId === item.productId
                ? { ...i, ...item, vessel: item.vessel ?? i.vessel, months: item.months ?? i.months, qty: i.qty + qty }
                : i,
            );
          }
          return [...prev, normalizeItem({ ...item, qty })];
        });
      },
      updateQty: (productId, qty) => {
        setItems((prev) =>
          qty <= 0
            ? prev.filter((i) => i.productId !== productId)
            : prev.map((i) => (i.productId === productId ? { ...i, qty } : i)),
        );
      },
      setVessel: (productId, vessel) => patch(productId, { vessel }),
      setMonths: (productId, months) => patch(productId, { months }),
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
