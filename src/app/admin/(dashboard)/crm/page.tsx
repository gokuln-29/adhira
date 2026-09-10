import type { Metadata } from "next";
import { LeadsBoard } from "@/components/admin/crm/leads-board";
import { getAllLeadsAdmin } from "@/lib/data/admin/leads";

export const metadata: Metadata = { title: "CRM" };

export default async function AdminCrmPage() {
  const leads = await getAllLeadsAdmin();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">CRM — Leads Pipeline</h1>
      <LeadsBoard leads={leads} />
    </div>
  );
}
