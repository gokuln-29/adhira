"use server";

import { createClient } from "@/lib/supabase/server";

export interface CustomerProfileInput {
  name: string;
  phone?: string;
  company?: string;
  trn?: string;
}

// Called once after first sign-in, before a `customers` row exists yet.
export async function ensureCustomerProfile(
  input: CustomerProfileInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (existing) return { ok: true };

  const { error } = await supabase.from("customers").insert({
    auth_user_id: user.id,
    name: input.name.trim() || user.email || "Customer",
    email: user.email ?? "",
    phone: input.phone?.trim() || null,
    company: input.company?.trim() || null,
    trn: input.trn?.trim() || null,
    type: input.company ? "corporate" : "retail",
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateCustomerProfile(
  input: CustomerProfileInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("customers")
    .update({
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      company: input.company?.trim() || null,
      trn: input.trn?.trim() || null,
      type: input.company ? "corporate" : "retail",
    })
    .eq("auth_user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
