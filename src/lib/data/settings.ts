import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { store_settings } from "@/lib/db/schema";

export interface StoreSettings {
  whatsapp_number: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  trn: string | null;
  hero_image_url: string | null;
  legal_name: string | null;
  legal_name_ar: string | null;
  address: string | null;
  address_ar: string | null;
}

const EMPTY: StoreSettings = {
  whatsapp_number: null,
  contact_phone: null,
  contact_email: null,
  trn: null,
  hero_image_url: null,
  legal_name: null,
  legal_name_ar: null,
  address: null,
  address_ar: null,
};

// Shared with the catalog cache tag so `refreshStorefront()` refreshes it too.
export const getStoreSettings = unstable_cache(
  async (): Promise<StoreSettings> => {
    const rows = await db
      .select({
        whatsapp_number: store_settings.whatsapp_number,
        contact_phone: store_settings.contact_phone,
        contact_email: store_settings.contact_email,
        trn: store_settings.trn,
        hero_image_url: store_settings.hero_image_url,
        legal_name: store_settings.legal_name,
        legal_name_ar: store_settings.legal_name_ar,
        address: store_settings.address,
        address_ar: store_settings.address_ar,
      })
      .from(store_settings)
      .limit(1);
    return rows[0] ?? EMPTY;
  },
  ["store-settings"],
  { tags: ["catalog"], revalidate: 300 },
);
