import { createAdminClient } from "@/lib/supabase/admin";

export interface OrderConfirmation {
  number: string;
  status: string;
  subtotal: number;
  vat: number;
  delivery_fee: number;
  total: number;
  currency: string;
  emirate: string | null;
  delivery_date: string | null;
  created_at: string;
  order_items: { name: string; qty: number; unit_price: number; line_total: number }[];
}

// Reads by order number (an unguessable token), not by user session — this is
// what backs the guest-checkout confirmation page. Server Component use only;
// never import into a Client Component.
export async function getOrderByNumber(
  number: string,
): Promise<OrderConfirmation | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "number, status, subtotal, vat, delivery_fee, total, currency, emirate, delivery_date, created_at, order_items(name, qty, unit_price, line_total)",
    )
    .eq("number", number)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as OrderConfirmation | null;
}
