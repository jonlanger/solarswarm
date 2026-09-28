import { cn } from "@/lib/cn";

/** Battery state-of-charge gauge — copper fill, turns warning/danger when low. */
export function BatteryGauge({
  value,
  className,
  showLabel = true,
}: {
  value: number; // 0..100
  className?: string;
  showLabel?: boolean;
}) {
  const v = Math.max(0, Math.min(100, value));
  const fill = v < 15 ? "bg-danger" : v < 30 ? "bg-warning" : "bg-copper";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="relative h-3 flex-1 min-w-10 rounded-[4px] border border-border-strong p-[2px]"
        role="meter"
        aria-valuenow={Math.round(v)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Battery"
      >
        <div className={cn("h-full rounded-[2px]", fill)} style={{ width: `${v}%` }} />
        <span className="absolute -right-[4px] top-1/2 -translate-y-1/2 h-1.5 w-[3px] rounded-r-sm bg-border-strong" />
      </div>
      {showLabel && <span className="font-mono tabular text-xs text-muted w-9 text-right">{Math.round(v)}%</span>}
    </div>
  );
}

/** Radial gauge for a single percentage (e.g. fleet availability). */
export function RingGauge({
  value,
  label,
  color = "var(--primary)",
  size = 96,
}: {
  value: number;
  label?: string;
  color?: string;
  size?: number;
}) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-mono tabular text-lg font-semibold leading-none">{v.toFixed(1)}%</div>
          {label && <div className="text-[0.6875rem] text-muted mt-1">{label}</div>}
        </div>
      </div>
    </div>
  );
}
