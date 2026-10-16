import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";

export interface LeadRow {
  id: string;
  company: string | null;
  contact: string;
  email: string | null;
  phone: string | null;
  requirement: string | null;
  frequency: string | null;
  emirate: string | null;
  budget: string | null;
  message: string | null;
  stage: "new" | "contacted" | "quoted" | "won" | "lost";
  created_at: string;
}

export async function getAllLeadsAdmin(): Promise<LeadRow[]> {
  return db
    .select({
      id: leads.id,
      company: leads.company,
      contact: leads.contact,
      email: leads.email,
      phone: leads.phone,
      requirement: leads.requirement,
      frequency: leads.frequency,
      emirate: leads.emirate,
      budget: leads.budget,
      message: leads.message,
      stage: leads.stage,
      created_at: leads.created_at,
    })
    .from(leads)
    .orderBy(desc(leads.created_at));
}
