import { z } from "zod";
import { EMIRATES } from "@/lib/constants/emirates";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

export const leadInputSchema = z.object({
  contact: z.string().trim().min(2, "Contact name is required.").max(120),
  company: optionalText(160),
  email: z
    .union([z.literal(""), z.email().max(200)])
    .optional()
    .transform((v) => v || null),
  phone: optionalText(30),
  requirement: optionalText(300),
  frequency: optionalText(100),
  emirate: z
    .union([z.literal(""), z.enum(EMIRATES)])
    .optional()
    .transform((v) => v || null),
  budget: optionalText(100),
  message: optionalText(2000),
  // Honeypot: real people never see or fill this field.
  website: z.string().max(0).optional(),
});
