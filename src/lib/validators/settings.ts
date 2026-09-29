import { z } from "zod";

const blankToNull = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

// Hero images must come from our own storage (or the seed image host) so
// `next/image` can load them and nobody can point the homepage at a random host.
function allowedImageHost(url: string): boolean {
  try {
    const u = new URL(url);
    const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
      : null;
    return (
      u.origin === supabase ||
      u.hostname.endsWith(".supabase.co") ||
      u.hostname === "images.unsplash.com"
    );
  } catch {
    return false;
  }
}

export const storeSettingsSchema = z.object({
  whatsapp_number: z
    .string()
    .optional()
    .transform((v) => (v ?? "").replace(/[\s+()-]/g, ""))
    .refine((v) => v === "" || /^[0-9]{8,15}$/.test(v), "WhatsApp number: digits only with country code, e.g. 971501234567.")
    .transform((v) => v || null),
  contact_phone: z.string().max(30).optional().transform(blankToNull),
  contact_email: z
    .union([z.literal(""), z.email().max(200)], "Enter a valid contact email.")
    .optional()
    .transform(blankToNull),
  trn: z
    .string()
    .optional()
    .transform((v) => (v ?? "").replace(/\s/g, ""))
    .refine((v) => v === "" || /^[0-9]{15}$/.test(v), "TRN must be exactly 15 digits.")
    .transform((v) => v || null),
  hero_image_url: z
    .string()
    .max(2000)
    .optional()
    .transform(blankToNull)
    .refine((v) => v === null || allowedImageHost(v), "Upload the hero image here, or use an Unsplash / Supabase image URL."),
});

export type StoreSettingsInput = z.input<typeof storeSettingsSchema>;
