"use client";

import { cn } from "@/lib/cn";
import { useRovingKeys } from "./segmented";

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  className,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { value: T; label: React.ReactNode }[];
  className?: string;
  /** accessible name for the tab list */
  label?: string;
}) {
  const { refs, onKeyDown } = useRovingKeys(
    tabs.map((t) => t.value),
    value,
    onChange,
  );
  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("flex gap-5 border-b border-border overflow-x-auto [scrollbar-width:none]", className)}
    >
      {tabs.map((t, i) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={cn(
              "relative h-10 text-sm font-medium whitespace-nowrap cursor-pointer transition shrink-0",
              active ? "text-text" : "text-muted hover:text-text",
            )}
          >
            {t.label}
            {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-swarm" />}
          </button>
        );
      })}
    </div>
  );
}
