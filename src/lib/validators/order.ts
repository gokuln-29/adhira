import { z } from "zod";
import { EMIRATES } from "@/lib/constants/emirates";

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  text(max)
    .optional()
    .transform((v) => v || undefined);

export const MAX_LINE_QTY = 100;
export const MAX_CART_LINES = 50;

// Note there is deliberately NO price, name or VAT field: the server prices
// every line from the products table.
export const orderInputSchema = z.object({
  customer: z.object({
    name: text(120).min(2, "Please enter your name."),
    email: z.email("Please enter a valid email.").max(200),
    phone: text(30).regex(/^[+\d][\d\s()-]{6,}$/, "Please enter a valid phone number."),
    company: optionalText(160),
    trn: optionalText(30),
  }),
  emirate: z.enum(EMIRATES),
  address: z.object({
    line1: text(200).min(3, "Please enter your address."),
    line2: optionalText(200),
    area: optionalText(120),
    landmark: optionalText(200),
  }),
  deliveryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  deliverySlot: optionalText(60),
  giftMessage: optionalText(500),
  poNumber: optionalText(60),
  paymentMethod: z.enum(["cod", "card", "tabby", "tamara"]),
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        qty: z.number().int().min(1).max(MAX_LINE_QTY),
        vessel: z.boolean().default(false),
        months: z.number().int().min(1).max(60).default(1),
      }),
    )
    .min(1, "Your cart is empty.")
    .max(MAX_CART_LINES),
  locale: z.enum(["en", "ar"]),
  // Generated per checkout attempt in the browser; a repeat submit returns the same order.
  idempotencyKey: z.string().min(16).max(64).regex(/^[A-Za-z0-9_-]+$/).optional(),
  acceptTerms: z.literal(true, "Please accept the terms and conditions to place your order."),
});

export type ValidatedOrderInput = z.infer<typeof orderInputSchema>;
