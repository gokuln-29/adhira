"use client";

import { useState } from "react";
import { formatAED } from "@/lib/pricing";

const WIDTH = 640;
const HEIGHT = 220;
const PAD_LEFT = 48;
const PAD_BOTTOM = 24;
const PAD_TOP = 16;

export function RevenueChart({ data }: { data: { date: string; revenue: number }[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-(--color-muted)">
        No revenue in this period yet.
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.revenue), 1);
  const plotWidth = WIDTH - PAD_LEFT - 16;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const points = data.map((d, i) => {
    const x = PAD_LEFT + (data.length === 1 ? plotWidth / 2 : (i / (data.length - 1)) * plotWidth);
    const y = PAD_TOP + plotHeight - (d.revenue / max) * plotHeight;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x},${PAD_TOP + plotHeight} L${points[0].x},${PAD_TOP + plotHeight} Z`;

  const yTicks = [0, 0.5, 1].map((f) => ({
    value: max * f,
    y: PAD_TOP + plotHeight - f * plotHeight,
  }));

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
          let nearest = 0;
          let nearestDist = Infinity;
          points.forEach((p, i) => {
            const dist = Math.abs(p.x - relX);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearest = i;
            }
          });
          setHoverIndex(nearest);
        }}
      >
        {yTicks.map((t) => (
          <g key={t.y}>
            <line
              x1={PAD_LEFT}
              x2={WIDTH - 16}
              y1={t.y}
              y2={t.y}
              stroke="var(--color-hairline)"
              strokeWidth={1}
            />
            <text x={0} y={t.y + 4} fontSize={10} fill="var(--color-muted)" fontFamily="var(--font-mono-brand)">
              {Math.round(t.value)}
            </text>
          </g>
        ))}

        <path d={areaPath} fill="var(--color-primary)" opacity={0.1} />
        <path d={linePath} fill="none" stroke="var(--color-primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === points.length - 1 || i === hoverIndex ? 4 : 0}
            fill="var(--color-primary)"
            stroke="var(--color-surface)"
            strokeWidth={2}
          />
        ))}

        {hovered && (
          <line
            x1={hovered.x}
            x2={hovered.x}
            y1={PAD_TOP}
            y2={PAD_TOP + plotHeight}
            stroke="var(--color-muted)"
            strokeWidth={1}
            strokeDasharray="2 2"
          />
        )}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 border border-(--color-hairline) bg-(--color-surface) px-2 py-1 font-mono-label text-[10px] shadow-sm"
          style={{ left: `${(hovered.x / WIDTH) * 100}%` }}
        >
          <div className="text-(--color-muted)">{hovered.date}</div>
          <div>{formatAED(hovered.revenue)}</div>
        </div>
      )}
    </div>
  );
}
