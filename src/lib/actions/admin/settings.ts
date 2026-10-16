"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { store_settings } from "@/lib/db/schema";
import { authorize } from "@/lib/admin/auth";
import { syncStockAlerts } from "@/lib/ops/stock";
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

  try {
    const [before] = await db.select({ t: store_settings.low_stock_threshold }).from(store_settings).where(eq(store_settings.id, 1)).limit(1);
    await db.update(store_settings).set(parsed.data).where(eq(store_settings.id, 1));
    // A new alert level changes which products count as low.
    if (before?.t !== parsed.data.low_stock_threshold) await syncStockAlerts();
  } catch (err) {
    console.error("[updateStoreSettings]", err);
    return { ok: false, error: "Couldn't save the settings. Please try again." };
  }
  revalidatePath("/admin/settings");
  refreshStorefront();
  return { ok: true };
}
