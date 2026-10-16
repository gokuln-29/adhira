// Stock status, shared by the storefront (client-safe) and the admin.
// `stock_qty` NULL means "not tracked": always sellable, never low.
export type StockStatus = "untracked" | "out" | "low" | "ok";

export function stockStatus(qty: number | null | undefined, threshold: number): StockStatus {
  if (qty == null) return "untracked";
  if (qty <= 0) return "out";
  return qty <= threshold ? "low" : "ok";
}
