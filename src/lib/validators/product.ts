import { z } from "zod";

const money = z.number().finite().min(0).max(1_000_000);
const httpUrl = z
  .string()
  .max(2000)
  .refine((v) => /^https?:\/\//i.test(v), "Image URL must start with http(s)://");

export const productInputSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a product name.").max(200),
    slug: z
      .string()
      .trim()
      .min(1, "Enter a slug.")
      .max(200)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug can only use lowercase letters, numbers and dashes."),
    short_description: z.string().trim().max(500),
    name_ar: z.string().trim().max(200),
    short_description_ar: z.string().trim().max(500),
    details: z
      .array(z.object({ label: z.string().trim().min(1).max(100), value: z.string().trim().min(1).max(200) }))
      .max(30),
    base_price: money,
    discount_type: z.enum(["percent", "flat"]).nullable(),
    discount_value: money.nullable(),
    sale_start: z.string().max(40).nullable(),
    sale_end: z.string().max(40).nullable(),
    category_id: z.uuid().nullable(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20),
    status: z.enum(["draft", "active"]),
    images: z
      .array(z.object({ url: httpUrl, alt: z.string().trim().max(200), is_primary: z.boolean() }))
      .max(20),

    // Order rules
    min_order_qty: z.number().int().min(1, "Minimum quantity must be at least 1.").max(1000),
    min_order_value: money,
    // Glass vessel
    allows_vessel: z.boolean(),
    vessel_price: money,
    vessel_deposit: money,
    // Rental
    is_rental: z.boolean(),
    rental_monthly_price: money.nullable(),
    rental_min_months: z.number().int().min(1).max(60),
    rental_deposit: money,
  })
  .superRefine((p, ctx) => {
    if (p.discount_type === "percent" && (p.discount_value ?? 0) > 100) {
      ctx.addIssue({ code: "custom", path: ["discount_value"], message: "Percent discount can't exceed 100." });
    }
    if (p.is_rental && (p.rental_monthly_price ?? 0) <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["rental_monthly_price"],
        message: "Enter the monthly rental price for a rental product.",
      });
    }
  })
  // Fields of a feature that is switched off are stored as neutral values so
  // stale numbers can never leak into pricing.
  .transform((p) => ({
    ...p,
    vessel_price: p.allows_vessel ? p.vessel_price : 0,
    vessel_deposit: p.allows_vessel ? p.vessel_deposit : 0,
    rental_monthly_price: p.is_rental ? p.rental_monthly_price : null,
    rental_min_months: p.is_rental ? p.rental_min_months : 1,
    rental_deposit: p.is_rental ? p.rental_deposit : 0,
  }));

export type ProductInput = z.output<typeof productInputSchema>;
