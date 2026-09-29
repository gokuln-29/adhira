"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/admin/auth";
import { refreshStorefront } from "@/lib/actions/admin/refresh-storefront";
import { storeSettingsSchema, type StoreSettingsInput } from "@/lib/validators/settings";

export async function updateStoreSettings(
  raw: StoreSettingsInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await authorize("ownerOnly");
  if (!auth.ok) return auth;

  const parsed = storeSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the details." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("store_settings").update(parsed.data).eq("id", true);
  if (error) {
    console.error("[updateStoreSettings]", error);
    return { ok: false, error: "Couldn't save the settings. Please try again." };
  }
  revalidatePath("/admin/settings");
  refreshStorefront();
  return { ok: true };
}
