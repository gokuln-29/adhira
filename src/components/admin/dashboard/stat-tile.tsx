import { Card } from "@/components/ui/card";
import { MonoLabel } from "@/components/ui/mono-label";

function formatDelta(current: number, previous: number): { label: string; positive: boolean } | null {
  if (previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  return { label: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`, positive: pct >= 0 };
}

export function StatTile({
  label,
  value,
  previous,
  currentRaw,
}: {
  label: string;
  value: string;
  previous?: number;
  currentRaw?: number;
}) {
  const delta =
    previous !== undefined && currentRaw !== undefined
      ? formatDelta(currentRaw, previous)
      : null;

  return (
    <Card className="p-5">
      <MonoLabel className="text-[10px]">{label}</MonoLabel>
      <p className="mt-2 font-mono-label text-2xl text-(--color-ink)">{value}</p>
      {delta && (
        <MonoLabel
          as="p"
          muted={false}
          className={`mt-1 text-[11px] ${delta.positive ? "text-(--color-primary)" : "text-red-600"}`}
        >
          {delta.label} vs prior period
        </MonoLabel>
      )}
    </Card>
  );
}
