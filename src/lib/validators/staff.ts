import { z } from "zod";

export const staffInputSchema = z.object({
  name: z.string().trim().min(2, "Enter a name.").max(120),
  email: z.email("Enter a valid email.").max(200),
  password: z
    .string()
    .min(12, "Use at least 12 characters.")
    .max(128)
    .regex(/[a-z]/, "Add a lowercase letter.")
    .regex(/[A-Z]/, "Add an uppercase letter.")
    .regex(/\d/, "Add a number."),
  role: z.enum(["owner", "manager", "staff"]),
});
