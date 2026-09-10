"use server";

import { createClient } from "@/lib/supabase/server";

export interface LeadInput {
  contact: string;
  company?: string;
  email?: string;
  phone?: string;
  requirement?: string;
  frequency?: string;
  emirate?: string;
  budget?: string;
  message?: string;
}

export async function createLead(
  input: LeadInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.contact?.trim()) {
    return { ok: false, error: "Contact name is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("leads").insert({
    contact: input.contact.trim(),
    company: input.company?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    requirement: input.requirement?.trim() || null,
    frequency: input.frequency?.trim() || null,
    emirate: input.emirate || null,
    budget: input.budget?.trim() || null,
    message: input.message?.trim() || null,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
