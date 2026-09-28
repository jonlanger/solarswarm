import { cn } from "@/lib/cn";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Sparkline } from "./sparkline";

export function StatTile({
  label,
  value,
  unit,
  delta,
  deltaGoodWhen = "up",
  spark,
  sparkColor = "var(--chart-1)",
  icon,
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: number;
  deltaGoodWhen?: "up" | "down";
  spark?: number[];
  sparkColor?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  const up = (delta ?? 0) >= 0;
  const good = deltaGoodWhen === "up" ? up : !up;
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] bg-surface border border-border p-4 flex flex-col gap-3 min-w-0",
        className,
      )}
    >
      {/* wraps: when the tile is narrow (small screens, large text) the delta drops below the label */}
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1 text-[0.8125rem] text-muted">
        <span className="flex min-w-0 items-start gap-2 leading-snug">
          {icon && (
            <span className="mt-px shrink-0 [&_svg]:size-4" aria-hidden>
              {icon}
            </span>
          )}
          <span className="min-w-0">{label}</span>
        </span>
        {delta !== undefined && (
          <span
            className={cn(
              "ml-auto inline-flex shrink-0 items-center gap-0.5 text-xs font-medium tabular",
              good ? "text-success" : "text-danger",
            )}
          >
            {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            <span className="sr-only">{up ? "up" : "down"} </span>
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="mt-auto flex items-end justify-between gap-3">
        <div className="font-mono tabular text-[1.375rem] 2xl:text-[1.625rem] leading-none font-semibold tracking-tight whitespace-nowrap">
          {value}
          {unit && <span className="text-sm text-muted font-sans font-normal ml-1">{unit}</span>}
        </div>
        {spark && <Sparkline data={spark} color={sparkColor} className="w-14 sm:w-20 2xl:w-24 h-8 shrink min-w-0" />}
      </div>
    </div>
  );
}
