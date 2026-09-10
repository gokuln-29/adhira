"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface OfferFormInput {
  title: string;
  type: "percent" | "flat" | "code";
  value: number;
  code: string | null;
  scope: string;
  starts: string | null;
  ends: string | null;
  active: boolean;
}

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export async function createOffer(input: OfferFormInput): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("offers")
    .insert({
      title: input.title.trim(),
      type: input.type,
      value: input.value,
      code: input.code?.trim() || null,
      scope: input.scope,
      starts: input.starts,
      ends: input.ends,
      active: input.active,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/offers");
  return { ok: true, id: data.id };
}

export async function updateOffer(id: string, input: OfferFormInput): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("offers")
    .update({
      title: input.title.trim(),
      type: input.type,
      value: input.value,
      code: input.code?.trim() || null,
      scope: input.scope,
      starts: input.starts,
      ends: input.ends,
      active: input.active,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/offers");
  return { ok: true };
}

export async function deleteOffer(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("offers").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/offers");
  return { ok: true };
}
