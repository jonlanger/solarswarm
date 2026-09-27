import { cn } from "@/lib/cn";
import { Check } from "lucide-react";

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2 w-full">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex items-center gap-2 flex-1 min-w-0 last:flex-none">
            <span
              className={cn(
                "size-7 shrink-0 rounded-full grid place-items-center text-xs font-semibold border",
                done && "bg-swarm text-white border-transparent",
                active && "border-primary text-primary bg-primary-soft",
                !done && !active && "border-border-strong text-muted",
              )}
            >
              {done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                "text-[13px] truncate hidden sm:block",
                active ? "text-text font-medium" : "text-muted",
              )}
            >
              {s}
            </span>
            {i < steps.length - 1 && (
              <span className={cn("h-px flex-1 min-w-4", done ? "bg-primary" : "bg-border")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
