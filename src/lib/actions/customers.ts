"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { readCustomerSession } from "@/lib/auth/customer-session";
import { assertSameOrigin } from "@/lib/auth/origin";

export interface CustomerProfileInput {
  name: string;
  phone?: string;
  company?: string;
  trn?: string;
}

const profileSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(200),
  phone: z.string().trim().max(50).optional(),
  company: z.string().trim().max(200).optional(),
  trn: z.string().trim().max(30).optional(),
});

export async function updateCustomerProfile(
  input: CustomerProfileInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await assertSameOrigin())) return { ok: false, error: "Request blocked." };
  const session = await readCustomerSession();
  if (!session) return { ok: false, error: "Not signed in." };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your details." };
  const p = parsed.data;

  await db
    .update(customers)
    .set({
      name: p.name,
      phone: p.phone || null,
      company: p.company || null,
      trn: p.trn || null,
      type: p.company ? "corporate" : "retail",
    })
    .where(eq(customers.id, session.id));
  return { ok: true };
}
