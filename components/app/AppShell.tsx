"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  Activity,
  Bot,
  ChevronDown,
  Clock,
  LayoutDashboard,
  Map,
  Menu,
  PlusCircle,
  Wrench,
  X,
} from "lucide-react";
import { IconButton, Logo, Segmented, ThemeToggle } from "@/components/ui";
import { cn } from "@/lib/cn";
import { localTimeLabel } from "@/lib/sim/energy";
import { ROLE_META, orgName, sitesForRole, type Role } from "@/lib/sim/model";
import { useSim, useSimClock } from "@/lib/sim/store";

const NAV: { href: string; label: string; Icon: typeof Map; roles?: Role[]; buyerLabel?: string }[] = [
  { href: "/app", label: "Overview", Icon: LayoutDashboard },
  { href: "/app/map", label: "Fleet map", Icon: Map },
  { href: "/app/robots", label: "Robots", Icon: Bot },
  { href: "/app/energy", label: "Energy in / out", Icon: Activity },
  { href: "/app/maintenance", label: "Maintenance & support", Icon: Wrench, buyerLabel: "Service & support" },
  { href: "/app/onboarding", label: "Onboard robots", Icon: PlusCircle, roles: ["ops", "lessor"] },
];

function RoleFromUrl() {
  const params = useSearchParams();
  const setRole = useSim((s) => s.setRole);
  useEffect(() => {
    const r = params.get("role") as Role | null;
    if (r && r in ROLE_META) setRole(r);
  }, [params, setRole]);
  return null;
}

function SimClock() {
  const now = useSim((s) => s.now);
  const speed = useSim((s) => s.speed);
  const setSpeed = useSim((s) => s.setSpeed);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div className="hidden md:flex items-center gap-2 h-9 pl-3 pr-1 rounded-[var(--radius-sm)] border border-border bg-surface text-[13px]">
      <Clock className="size-3.5 text-muted" />
      <span className="font-mono tabular w-[74px]">
        {mounted ? localTimeLabel(new Date(now), "America/Los_Angeles") : "--:--"}
      </span>
      <span className="text-subtle text-xs">PT</span>
      <select
        aria-label="Simulation speed"
        value={speed}
        onChange={(e) => setSpeed(Number(e.target.value))}
        className="h-7 rounded-[6px] bg-surface-2 px-1.5 text-xs font-mono cursor-pointer outline-none"
      >
        <option value={1}>1×</option>
        <option value={60}>60×</option>
        <option value={600}>600×</option>
        <option value={3600}>3600×</option>
      </select>
    </div>
  );
}

function SitePicker() {
  const role = useSim((s) => s.role);
  const siteId = useSim((s) => s.siteId);
  const setSite = useSim((s) => s.setSite);
  const sites = sitesForRole(role);
  return (
    <div className="relative">
      <select
        aria-label="Site"
        value={siteId}
        onChange={(e) => setSite(e.target.value)}
        className="appearance-none h-9 pl-3 pr-8 rounded-[var(--radius-sm)] border border-border bg-surface text-[13px] cursor-pointer outline-none w-[112px] sm:w-auto sm:max-w-[220px] truncate"
      >
        <option value="all">All sites ({sites.length})</option>
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <ChevronDown className="size-4 absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  useSimClock();
  const pathname = usePathname();
  const role = useSim((s) => s.role);
  const setRole = useSim((s) => s.setRole);
  const [open, setOpen] = useState(false);
  // the platform is a live client-side simulation: render it after mount to avoid SSR/clock mismatches
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [pathname]);
  const meta = ROLE_META[role];

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {NAV.filter((n) => !n.roles || n.roles.includes(role)).map(({ href, label, Icon, buyerLabel }) => {
        const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 h-10 px-3 rounded-[var(--radius-sm)] text-sm transition",
              active ? "bg-primary-soft text-primary-soft-fg font-medium" : "text-muted hover:text-text hover:bg-surface-2",
            )}
          >
            <Icon className="size-[18px]" />
            {role === "buyer" && buyerLabel ? buyerLabel : label}
          </Link>
        );
      })}
    </nav>
  );

  const roleCard = (
    <div className="rounded-[var(--radius-md)] p-3 bg-swarm-soft border border-border">
      <div className="text-[11px] uppercase tracking-wider text-subtle">Signed in as</div>
      <div className="text-sm font-medium mt-1">{meta.orgId ? orgName(meta.orgId) : "SolarSwarm Operations"}</div>
      <div className="text-xs text-muted mt-0.5">{meta.short}</div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-bg">
      <Suspense fallback={null}>
        <RoleFromUrl />
      </Suspense>
      {/* sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col gap-6 border-r border-border bg-surface px-3 py-4">
        <Link href="/" className="px-2">
          <Logo />
        </Link>
        {nav}
        <div className="mt-auto">{roleCard}</div>
      </aside>
      {/* mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-[var(--overlay)]" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-surface border-r border-border p-4 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <Logo />
              <IconButton label="Close menu" size="sm" onClick={() => setOpen(false)}>
                <X className="size-4" />
              </IconButton>
            </div>
            {nav}
            <div className="mt-auto">{roleCard}</div>
          </div>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 h-14 glass border-x-0 border-t-0 !border-b-border flex items-center gap-2 sm:gap-3 px-3 sm:px-6">
          <IconButton label="Open menu" className="lg:hidden" onClick={() => setOpen(true)}>
            <Menu className="size-5" />
          </IconButton>
          <Segmented
            className="hidden md:inline-flex"
            size="sm"
            value={role}
            onChange={setRole}
            options={(Object.keys(ROLE_META) as Role[]).map((r) => ({ value: r, label: ROLE_META[r].short }))}
          />
          <select
            aria-label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="md:hidden h-9 px-1.5 w-[112px] rounded-[var(--radius-sm)] border border-border bg-surface text-[13px]"
          >
            {(Object.keys(ROLE_META) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_META[r].short}
              </option>
            ))}
          </select>
          <div className="ml-auto flex items-center gap-2">
            <SitePicker />
            <SimClock />
            <ThemeToggle />
          </div>
        </header>
        <main className="px-3 sm:px-6 py-6">
          {mounted ? children : <div className="h-96 rounded-[var(--radius-lg)] bg-surface animate-pulse" />}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
