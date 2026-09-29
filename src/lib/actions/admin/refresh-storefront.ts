import { revalidatePath, updateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/data/products";

// Call from admin server actions after any change customers can see, so the
// storefront updates immediately rather than after the cache timer.
export function refreshStorefront() {
  updateTag(CATALOG_TAG);
  revalidatePath("/[locale]", "layout");
}
