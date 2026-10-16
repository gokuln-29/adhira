import { z } from "zod";
import { isAllowedImageUrl } from "@/lib/media/allowed-url";

const blankToNull = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

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
  low_stock_threshold: z.number().int().min(0).max(1000),
  legal_name: z.string().max(200).optional().transform(blankToNull),
  legal_name_ar: z.string().max(200).optional().transform(blankToNull),
  address: z.string().max(500).optional().transform(blankToNull),
  address_ar: z.string().max(500).optional().transform(blankToNull),
  hero_image_url: z
    .string()
    .max(2000)
    .optional()
    .transform(blankToNull)
    .refine((v) => v === null || isAllowedImageUrl(v), "Upload the hero image here, or use an Unsplash image URL."),
});

export type StoreSettingsInput = z.input<typeof storeSettingsSchema>;
