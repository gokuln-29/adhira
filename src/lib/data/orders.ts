import { createAdminClient } from "@/lib/supabase/admin";

export interface OrderConfirmation {
  number: string;
  status: string;
  subtotal: number;
  vat: number;
  delivery_fee: number;
  deposit_total: number;
  total: number;
  currency: string;
  emirate: string | null;
  delivery_date: string | null;
  created_at: string;
  order_items: { name: string; qty: number; unit_price: number; line_total: number }[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Reads by `orders.public_token` (a random UUID that only the buyer's browser
// and Stripe redirect ever see), not by the human-readable order number —
// numbers are shareable and must never unlock an order page. Backs the
// guest-checkout confirmation page. Server Component use only.
export async function getOrderByToken(
  token: string,
): Promise<OrderConfirmation | null> {
  if (!UUID.test(token)) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "number, status, subtotal, vat, delivery_fee, deposit_total, total, currency, emirate, delivery_date, created_at, order_items(name, qty, unit_price, line_total)",
    )
    .eq("public_token", token)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as OrderConfirmation | null;
}
