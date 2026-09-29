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
