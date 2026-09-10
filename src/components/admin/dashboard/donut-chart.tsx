import { formatAED } from "@/lib/pricing";
import { MonoLabel } from "@/components/ui/mono-label";

// Validated pair (emerald + blue) — see CLAUDE.md dataviz notes. A 3rd+
// segment folds into a neutral "Other" rather than adding an unvalidated hue.
const SLOT_COLORS = ["#0E7C5A", "#2a78d6"];
const OTHER_COLOR = "#B7BDB9";

const SIZE = 160;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 3;

export function DonutChart({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-[160px] items-center justify-center text-sm text-(--color-muted)">
        No data in this period yet.
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 2);
  const otherValue = sorted.slice(2).reduce((sum, d) => sum + d.value, 0);
  const segments = [
    ...top.map((d, i) => ({ ...d, color: SLOT_COLORS[i] })),
    ...(otherValue > 0 ? [{ name: "Other", value: otherValue, color: OTHER_COLOR }] : []),
  ];

  let offset = 0;
  const arcs = segments.map((seg) => {
    const length = (seg.value / total) * CIRCUMFERENCE - GAP;
    const arc = { ...seg, dasharray: `${Math.max(length, 0)} ${CIRCUMFERENCE}`, dashoffset: -offset };
    offset += (seg.value / total) * CIRCUMFERENCE;
    return arc;
  });

  return (
    <div className="flex items-center gap-6">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          {arcs.map((arc) => (
            <circle
              key={arc.name}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={arc.color}
              strokeWidth={STROKE}
              strokeDasharray={arc.dasharray}
              strokeDashoffset={arc.dashoffset}
            />
          ))}
        </g>
      </svg>

      <div className="flex flex-col gap-2">
        {segments.map((seg) => (
          <div key={seg.name} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: seg.color }}
              aria-hidden
            />
            <span className="text-sm text-(--color-ink)">{seg.name}</span>
            <MonoLabel className="ms-auto text-[10px]">
              {formatAED(seg.value)} &middot; {Math.round((seg.value / total) * 100)}%
            </MonoLabel>
          </div>
        ))}
      </div>
    </div>
  );
}
