// Fulfilment state machine (PDF §4). Payment is tracked separately in
// `orders.payment_status` so Cash on Delivery is never marked paid automatically.
export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "dispatched",
  "delivered",
  "cancelled",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["unpaid", "paid", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// Allowed fulfilment transitions. Anything else is rejected server-side.
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["dispatched", "cancelled"],
  dispatched: ["delivered", "cancelled"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

// Statuses where the order still needs work.
export const OPEN_STATUSES: readonly OrderStatus[] = ["pending", "confirmed", "preparing", "dispatched"];
// Orders that count toward revenue (committed, not cancelled/refunded).
export const COMMITTED_STATUSES: readonly OrderStatus[] = ["confirmed", "preparing", "dispatched", "delivered"];
