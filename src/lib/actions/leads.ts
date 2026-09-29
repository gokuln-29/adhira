"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withinRateLimit } from "@/lib/security/rate-limit";
import { leadInputSchema } from "@/lib/validators/lead";

export type LeadInput = z.input<typeof leadInputSchema>;

export async function createLead(
  raw: LeadInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
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

  // Service role: the public insert policy on `leads` was removed so the REST
  // API can't be used to flood the table around this validation.
  const { error } = await createAdminClient().from("leads").insert(lead);
  if (error) {
    console.error("[createLead] insert failed", error);
    return { ok: false, error: "We couldn't send your enquiry. Please try again." };
  }
  return { ok: true };
}
