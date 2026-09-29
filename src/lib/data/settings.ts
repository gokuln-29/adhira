import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

export interface StoreSettings {
  whatsapp_number: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  trn: string | null;
  hero_image_url: string | null;
}

const EMPTY: StoreSettings = {
  whatsapp_number: null,
  contact_phone: null,
  contact_email: null,
  trn: null,
  hero_image_url: null,
};

// Shared with the catalog cache tag so `refreshStorefront()` refreshes it too.
export const getStoreSettings = unstable_cache(
  async (): Promise<StoreSettings> => {
    const { data } = await createPublicClient()
      .from("store_settings")
      .select("whatsapp_number, contact_phone, contact_email, trn, hero_image_url")
      .maybeSingle();
    return data ?? EMPTY;
  },
  ["store-settings"],
  { tags: ["catalog"], revalidate: 300 },
);
