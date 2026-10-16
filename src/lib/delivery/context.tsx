"use client";

import { createContext, useContext } from "react";
import type { DeliveryRules } from "@/lib/delivery/rules";

// Public delivery rules for the storefront UI (banner, estimator, checkout preview).
// Display only: the server re-validates every order against the live database rules.
const Ctx = createContext<DeliveryRules | null>(null);

export function DeliveryRulesProvider({ rules, children }: { rules: DeliveryRules; children: React.ReactNode }) {
  return <Ctx.Provider value={rules}>{children}</Ctx.Provider>;
}

export function useDeliveryRules(): DeliveryRules | null {
  return useContext(Ctx);
}
