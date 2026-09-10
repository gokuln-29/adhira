"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { MonoLabel } from "@/components/ui/mono-label";
import { updateLeadStage, type LeadStage } from "@/lib/actions/admin/leads";
import type { LeadRow } from "@/lib/data/admin/leads";

const stages: { key: LeadStage; label: string }[] = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "quoted", label: "Quoted" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

export function LeadsBoard({ leads }: { leads: LeadRow[] }) {
  const router = useRouter();
  const [dragId, setDragId] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());

  async function moveLead(id: string, stage: LeadStage) {
    setPending((p) => new Set(p).add(id));
    await updateLeadStage(id, stage);
    setPending((p) => {
      const next = new Set(p);
      next.delete(id);
      return next;
    });
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-4 overflow-x-auto sm:grid-cols-3 lg:grid-cols-5">
      {stages.map((stage) => {
        const stageLeads = leads.filter((l) => l.stage === stage.key);
        return (
          <div
            key={stage.key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragId) moveLead(dragId, stage.key);
              setDragId(null);
            }}
            className="flex min-w-56 flex-col gap-3 border border-(--color-hairline) bg-(--color-hairline)/10 p-3"
          >
            <div className="flex items-center justify-between px-1">
              <MonoLabel muted={false} className="text-[11px]">
                {stage.label}
              </MonoLabel>
              <MonoLabel className="text-[10px]">{stageLeads.length}</MonoLabel>
            </div>

            {stageLeads.map((lead) => (
              <Card
                key={lead.id}
                draggable
                onDragStart={() => setDragId(lead.id)}
                className={`cursor-grab p-3 ${pending.has(lead.id) ? "opacity-50" : ""}`}
              >
                <p className="text-sm font-medium">{lead.contact}</p>
                {lead.company && (
                  <p className="text-xs text-(--color-muted)">{lead.company}</p>
                )}
                {lead.requirement && (
                  <p className="mt-2 line-clamp-2 text-xs text-(--color-muted)">
                    {lead.requirement}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {lead.emirate && <MonoLabel className="text-[9px]">{lead.emirate}</MonoLabel>}
                  {lead.frequency && (
                    <MonoLabel className="text-[9px]">{lead.frequency}</MonoLabel>
                  )}
                </div>
              </Card>
            ))}
          </div>
        );
      })}
    </div>
  );
}
