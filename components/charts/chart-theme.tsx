"use client";

/** Shared chart styling (recessive grid/axes, text tokens for labels). */
export const axisProps = {
  stroke: "var(--chart-axis)",
  tick: { fill: "var(--text-subtle)", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

export const gridProps = {
  stroke: "var(--chart-grid)",
  strokeDasharray: "0",
  vertical: false,
} as const;

export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  unit = "",
  digits = 1,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string; dataKey: string }[];
  label?: number | string;
  labelFormatter?: (l: number | string) => string;
  unit?: string;
  digits?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[var(--radius-sm)] border border-border bg-surface shadow-md px-3 py-2 text-xs min-w-36">
      <div className="text-muted mb-1.5">{labelFormatter ? labelFormatter(label ?? "") : label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="size-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-mono tabular text-text">
            {Number(p.value).toFixed(digits)}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-3.5 h-0 border-t-2"
            style={{ borderColor: i.color, borderStyle: i.dashed ? "dashed" : "solid" }}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export const hourLabel = (h: number | string) => {
  const v = Number(h);
  const hh = Math.floor(v);
  const mm = Math.round((v - hh) * 60);
  const ap = hh >= 12 ? "pm" : "am";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return mm ? `${h12}:${String(mm).padStart(2, "0")}${ap}` : `${h12}${ap}`;
};
