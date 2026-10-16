import { z } from "zod";

const optionalInt = z
  .number()
  .int()
  .min(1)
  .max(1_000_000)
  .nullable();

export const offerInputSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a title.").max(200),
    type: z.enum(["percent", "flat"], "Choose percent or flat."),
    value: z.number().finite().positive("The value must be more than 0."),
    // Uppercase letters, digits, - and _ : easy to type and to say over the phone.
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,40}$/, "Codes are 3-40 characters: letters, digits, - or _.")
      .nullable(),
    scope: z.enum(["all", "category", "product"]),
    category_ids: z.array(z.uuid()).max(100),
    product_ids: z.array(z.uuid()).max(300),
    min_subtotal: z.number().finite().min(0).max(1_000_000),
    max_uses: optionalInt,
    max_uses_per_customer: optionalInt,
    // Calendar dates (YYYY-MM-DD, Dubai). The last day is included.
    starts: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    ends: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    active: z.boolean(),
  })
  .refine((v) => v.type !== "percent" || v.value <= 100, { path: ["value"], message: "A percentage can't be more than 100." })
  .refine((v) => v.scope !== "category" || v.category_ids.length > 0, "Pick at least one category.")
  .refine((v) => v.scope !== "product" || v.product_ids.length > 0, "Pick at least one product.")
  .refine((v) => !v.starts || !v.ends || v.starts <= v.ends, "The end date is before the start date.");

export type OfferInput = z.input<typeof offerInputSchema>;
