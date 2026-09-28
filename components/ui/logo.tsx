import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * SolarSwarm mark: three strokes — the panel at 45° balanced on the mast, the mast, the base.
 * Geometry comes from blender/logo.py (the same strokes are the robot's decal). The panel carries the swarm violet
 * (lifted on dark grounds); mast and base are currentColor so they follow the text color / theme.
 */
export function LogoMark({ className, mono = false }: { className?: string; mono?: boolean }) {
  const id = useId();
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-7 shrink-0", className)}
      fill="none"
      strokeWidth={3.4}
      strokeLinecap="round"
      aria-hidden
    >
      {!mono && (
        <defs>
          <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="9" y1="20" x2="23" y2="6">
            <stop offset="0" stopColor="#5b2bd9" className="[stop-color:#2a0e61] dark:[stop-color:#5b2bd9]" />
            <stop offset="0.55" stopColor="#7243f0" />
            <stop offset="1" stopColor="#bb97ff" className="[stop-color:#9d6bff] dark:[stop-color:#bb97ff]" />
          </linearGradient>
        </defs>
      )}
      <line x1="5" y1="25.5" x2="27" y2="25.5" stroke="currentColor" />
      <line x1="16" y1="13" x2="16" y2="25.5" stroke="currentColor" />
      <line x1="9" y1="20" x2="23" y2="6" stroke={mono ? "currentColor" : `url(#${id})`} />
    </svg>
  );
}

export function Logo({ className, wordmark = true }: { className?: string; wordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {wordmark && (
        <span className="font-semibold tracking-tight text-[17px]">
          Solar<span className="text-swarm">Swarm</span>
        </span>
      )}
    </span>
  );
}
