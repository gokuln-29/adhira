"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/admin/auth";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/constants/order";

export type { OrderStatus };

export async function updateOrderStatus(
  number: string,
  status: OrderStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await authorize("handleOrders");
  if (!auth.ok) return auth;
  if (!ORDER_STATUSES.includes(status)) return { ok: false, error: "Unknown status." };
  const supabase = await createClient();
  const { error } = await supabase.from("orders").update({ status }).eq("number", number);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${number}`);
  return { ok: true };
}

// Marks the refundable deposit (glass vessels / rental plants) as refunded once
// the items are back and the money has been returned to the customer. Only
// owners and managers: it records a payout.
export async function updateDepositStatus(
  number: string,
  status: "held" | "refunded",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  if (status !== "held" && status !== "refunded") return { ok: false, error: "Unknown status." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .update({ deposit_status: status })
    .eq("number", number)
    .gt("deposit_total", 0)
    .select("number");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "This order has no deposit." };
  revalidatePath(`/admin/orders/${number}`);
  return { ok: true };
}
