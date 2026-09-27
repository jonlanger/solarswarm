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
      <div className="flex items-center justify-between text-[13px] text-muted">
        <span className="flex items-center gap-2 truncate">
          {icon}
          {label}
        </span>
        {delta !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium tabular",
              good ? "text-success" : "text-danger",
            )}
          >
            {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="font-mono tabular text-[22px] 2xl:text-[26px] leading-none font-semibold tracking-tight whitespace-nowrap">
          {value}
          {unit && <span className="text-sm text-muted font-sans font-normal ml-1">{unit}</span>}
        </div>
        {spark && <Sparkline data={spark} color={sparkColor} className="w-14 sm:w-20 2xl:w-24 h-8 shrink min-w-0" />}
      </div>
    </div>
  );
}
