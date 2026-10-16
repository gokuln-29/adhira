"use server";

import { z } from "zod";
import { after } from "next/server";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { newId } from "@/lib/db/helpers";
import { assertSameOrigin } from "@/lib/auth/origin";
import { withinRateLimit } from "@/lib/security/rate-limit";
import { sendLeadNotification } from "@/lib/notify/order-emails";
import { leadInputSchema } from "@/lib/validators/lead";

export type LeadInput = z.input<typeof leadInputSchema>;

export async function createLead(
  raw: LeadInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await assertSameOrigin())) return { ok: false, error: "We couldn't send your enquiry. Please try again." };
  const parsed = leadInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }
  const { website, ...lead } = parsed.data;

  // Honeypot filled in: pretend success so bots learn nothing.
  if (website) return { ok: true };

  if (!lead.email && !lead.phone) {
    return { ok: false, error: "Please give us an email or phone number so we can reach you." };
  }

  if (!(await withinRateLimit("lead", 5, 600))) {
    return { ok: false, error: "Too many enquiries from this device. Please try again shortly." };
  }

  try {
    await db.insert(leads).values({ id: newId(), ...lead });
  } catch (err) {
    console.error("[createLead] insert failed", err);
    return { ok: false, error: "We couldn't send your enquiry. Please try again." };
  }
  after(() => sendLeadNotification(lead));
  return { ok: true };
}
