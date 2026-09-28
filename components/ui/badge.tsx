import { cn } from "@/lib/cn";
import { BatteryCharging, Route, SquareParking, Sun, TriangleAlert } from "lucide-react";

type Tone = "neutral" | "primary" | "copper" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted",
  primary: "bg-primary-soft text-primary-soft-fg",
  copper: "bg-accent-soft text-accent-soft-fg",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 h-6 px-2 rounded-full text-xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export type RobotStatus = "tracking" | "charging" | "moving" | "docked" | "fault";

export const statusMeta: Record<
  RobotStatus,
  { label: string; tone: Tone; color: string; Icon: typeof Sun }
> = {
  tracking: { label: "Tracking", tone: "primary", color: "var(--status-tracking)", Icon: Sun },
  charging: { label: "Charging", tone: "copper", color: "var(--status-charging)", Icon: BatteryCharging },
  moving: { label: "Moving", tone: "info", color: "var(--status-moving)", Icon: Route },
  docked: { label: "Docked", tone: "neutral", color: "var(--status-docked)", Icon: SquareParking },
  fault: { label: "Fault", tone: "danger", color: "var(--status-fault)", Icon: TriangleAlert },
};

export function StatusPill({ status, className }: { status: RobotStatus; className?: string }) {
  const m = statusMeta[status];
  return (
    <Badge tone={m.tone} className={className}>
      <m.Icon className="size-3.5" aria-hidden />
      {m.label}
    </Badge>
  );
}
