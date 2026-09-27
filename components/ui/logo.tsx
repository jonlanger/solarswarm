import { cn } from "@/lib/cn";

/** SolarSwarm mark: a hexagonal swarm cell with a copper sun core. */
export function Logo({ className, wordmark = true }: { className?: string; wordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" className="size-7 shrink-0" aria-hidden>
        <defs>
          <linearGradient id="ss-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2a0e61" />
            <stop offset="0.55" stopColor="#5b2bd9" />
            <stop offset="1" stopColor="#9d6bff" />
          </linearGradient>
          <linearGradient id="ss-c" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#eec39a" />
            <stop offset="0.5" stopColor="#b87333" />
            <stop offset="1" stopColor="#7a4a1f" />
          </linearGradient>
        </defs>
        <path d="M16 1.5 28.6 8.75v14.5L16 30.5 3.4 23.25V8.75Z" fill="url(#ss-g)" />
        <path d="M16 7.5 23.4 11.75v8.5L16 24.5 8.6 20.25v-8.5Z" fill="none" stroke="rgb(255 255 255 / .35)" strokeWidth="1.2" />
        <circle cx="16" cy="16" r="4.2" fill="url(#ss-c)" />
      </svg>
      {wordmark && (
        <span className="font-semibold tracking-tight text-[17px]">
          Solar<span className="text-swarm">Swarm</span>
        </span>
      )}
    </span>
  );
}
