import type { CategoryRow, ProductRow } from "@/lib/data/types";

// Product and category text is stored in English with optional Arabic
// alongside. Arabic pages show the Arabic text when the admin entered it and
// fall back to English otherwise, so nothing is ever blank.
const pick = (en: string | null, ar: string | null | undefined, locale: string) =>
  locale === "ar" && ar?.trim() ? ar : en;

export function localizeProduct(row: ProductRow, locale: string) {
  return {
    ...row,
    name: pick(row.name, row.name_ar, locale) ?? row.name,
    short_description: pick(row.short_description, row.short_description_ar, locale),
    categories: row.categories
      ? { ...row.categories, name: pick(row.categories.name, row.categories.name_ar, locale) ?? row.categories.name }
      : null,
  };
}

export function localizeCategory<T extends Pick<CategoryRow, "name" | "name_ar">>(row: T, locale: string): T {
  return { ...row, name: pick(row.name, row.name_ar, locale) ?? row.name };
}
