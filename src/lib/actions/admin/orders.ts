"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/admin/auth";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/constants/order";
import { after } from "next/server";
import { z } from "zod";
import { sendOrderNotifications } from "@/lib/notify/order-emails";
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

const referenceSchema = z.string().trim().min(3, "Enter the bank / transfer reference (3+ characters).").max(200);

// Owner-only escape hatch for money that arrived outside Stripe's normal flow
// (bank transfer, or a payment the webhook flagged for review). Requires a
// reference, is written to the order history, and emails the customer.
export async function markPaidManually(number: string, reference: string): Promise<Result> {
  const auth = await authorize("ownerOnly");
  if (!auth.ok) return auth;
  const ref = referenceSchema.safeParse(reference);
  if (!ref.success) return { ok: false, error: ref.error.issues[0]?.message ?? "Enter a reference." };
  const res = await markOrderPaid({ number }, `admin:${auth.admin.id}`, {
    manual: true,
    note: `manual: ${ref.data}`,
  });
  if (!res.ok) return res;
  if (res.changed) after(() => sendOrderNotifications(number, "en"));
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
