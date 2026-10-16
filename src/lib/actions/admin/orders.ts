"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/admin/auth";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/constants/order";
import { markOrderPaid, setDepositStatus, transitionOrder } from "@/lib/orders/transitions";

export type { OrderStatus };

type Result = { ok: true } | { ok: false; error: string };

function refresh(number: string) {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${number}`);
  revalidatePath("/admin");
}

export async function updateOrderStatus(number: string, status: OrderStatus): Promise<Result> {
  const auth = await authorize("handleOrders");
  if (!auth.ok) return auth;
  if (!ORDER_STATUSES.includes(status)) return { ok: false, error: "Unknown status." };
  const res = await transitionOrder({ number }, status, `admin:${auth.admin.id}`);
  if (!res.ok) return res;
  refresh(number);
  return { ok: true };
}

// Staff confirm they collected cash on delivery (or a bank transfer landed).
// Card payments are only ever marked paid by the verified Stripe webhook.
export async function markCashReceived(number: string): Promise<Result> {
  const auth = await authorize("handleOrders");
  if (!auth.ok) return auth;
  const res = await markOrderPaid({ number }, `admin:${auth.admin.id}`, { note: "manual: cash/transfer received" });
  if (!res.ok) return res;
  refresh(number);
  return { ok: true };
}

// Marks the refundable deposit (glass vessels / rental plants) as refunded once
// the items are back and the money has been returned to the customer. Only
// owners and managers: it records a payout.
export async function updateDepositStatus(number: string, status: "held" | "refunded"): Promise<Result> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  if (status !== "held" && status !== "refunded") return { ok: false, error: "Unknown status." };
  const res = await setDepositStatus(number, status, `admin:${auth.admin.id}`);
  if (!res.ok) return res;
  refresh(number);
  return { ok: true };
}
