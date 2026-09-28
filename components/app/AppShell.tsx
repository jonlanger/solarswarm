"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  Activity,
  Bot,
  CircleUserRound,
  Clock,
  Globe,
  LayoutDashboard,
  Map,
  MapPin,
  Menu as MenuIcon,
  Monitor,
  Moon,
  Pause,
  Play,
  CirclePlus,
  Settings,
  Sun,
  Wrench,
  X,
} from "lucide-react";
import { IconButton, Logo, Menu, Segmented, Select, ThemeToggle } from "@/components/ui";
import { useA11y } from "@/lib/a11y/settings";
import { cn } from "@/lib/cn";
import { localTimeLabel } from "@/lib/sim/energy";
import { ROLE_META, orgName, sitesForRole, type Role } from "@/lib/sim/model";
import { useSim, useSimClock } from "@/lib/sim/store";

const NAV: { href: string; label: string; Icon: typeof Map; roles?: Role[]; buyerLabel?: string; footer?: boolean }[] = [
  { href: "/app", label: "Overview", Icon: LayoutDashboard },
  { href: "/app/map", label: "Fleet map", Icon: Map },
  { href: "/app/robots", label: "Robots", Icon: Bot },
  { href: "/app/energy", label: "Energy in / out", Icon: Activity },
  { href: "/app/maintenance", label: "Maintenance & support", Icon: Wrench, buyerLabel: "Service & support" },
  { href: "/app/onboarding", label: "Onboard robots", Icon: CirclePlus, roles: ["ops", "lessor"] },
  { href: "/app/settings", label: "Settings", Icon: Settings, footer: true },
];

const ROLE_COMPACT: Record<Role, string> = { buyer: "Buyer", lessor: "Lessor", ops: "Ops" };

const SPEEDS = [1, 60, 600, 3600].map((v) => ({ value: v, label: `${v}×`, description: v === 1 ? "Real time" : `${v === 3600 ? "1 h" : `${v / 60} min`} per second` }));

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
  const paused = useA11y((s) => s.pauseLive);
  const setA11y = useA11y((s) => s.set);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div className="hidden md:flex items-center gap-1.5 h-9 pl-3 pr-1 rounded-[var(--radius-sm)] border border-border bg-surface text-[0.8125rem]">
      <Clock className="size-3.5 text-muted" />
      <span className="font-mono tabular w-[4.6rem]" aria-live="off">
        {mounted ? localTimeLabel(new Date(now), "America/Los_Angeles") : "--:--"}
      </span>
      <span className="text-subtle text-xs">PT</span>
      <IconButton
        size="sm"
        label={paused ? "Resume live updates" : "Pause live updates"}
        aria-pressed={paused}
        className="size-7"
        onClick={() => setA11y("pauseLive", !paused)}
      >
        {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
      </IconButton>
      <Select
        label="Simulation speed"
        hideLabel
        size="sm"
        align="end"
        value={speed}
        onChange={setSpeed}
        options={SPEEDS}
        className="w-[5.25rem]"
        triggerClassName="h-7 border-0 bg-surface-2 font-mono text-xs"
      />
    </div>
  );
}

function SitePicker({ className }: { className?: string }) {
  const role = useSim((s) => s.role);
  const siteId = useSim((s) => s.siteId);
  const setSite = useSim((s) => s.setSite);
  const sites = sitesForRole(role);
  return (
    <Select
      label="Site"
      hideLabel
      icon={<MapPin />}
      value={siteId}
      onChange={setSite}
      align="end"
      className={className}
      renderValue={(o) =>
        o.value === "all" ? (
          <>
            All sites<span className="hidden sm:inline"> ({sites.length})</span>
          </>
        ) : (
          o.label
        )
      }
      options={[
        { value: "all", label: `All sites (${sites.length})`, textValue: "all sites" },
        ...sites.map((s) => ({ value: s.id, label: s.name, description: s.region })),
      ]}
    />
  );
}

function AccountMenu() {
  const { theme, setTheme } = useTheme();
  const role = useSim((s) => s.role);
  const meta = ROLE_META[role];
  return (
    <Menu
      label="Account and settings"
      items={[
        { heading: meta.orgId ? orgName(meta.orgId) : "SolarSwarm Operations" },
        { label: "Settings & accessibility", icon: <Settings />, href: "/app/settings" },
        { separator: true },
        { heading: "Theme" },
        { label: "System", icon: <Monitor />, hint: theme === "system" ? "On" : undefined, onSelect: () => setTheme("system") },
        { label: "Light", icon: <Sun />, hint: theme === "light" ? "On" : undefined, onSelect: () => setTheme("light") },
        { label: "Dark", icon: <Moon />, hint: theme === "dark" ? "On" : undefined, onSelect: () => setTheme("dark") },
        { separator: true },
        { label: "SolarSwarm website", icon: <Globe />, href: "/" },
      ]}
    >
      <CircleUserRound className="size-5" />
    </Menu>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const paused = useA11y((s) => s.pauseLive);
  useSimClock(1000, paused);
  const pathname = usePathname();
  const role = useSim((s) => s.role);
  const setRole = useSim((s) => s.setRole);
  const [open, setOpen] = useState(false);
  // the platform is a live client-side simulation: render it after mount to avoid SSR/clock mismatches
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [pathname]);
  const meta = ROLE_META[role];

  // mobile drawer: modal dialog semantics, Escape to close, focus in and back out
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const trigger = menuButtonRef.current;
    drawerRef.current?.querySelector<HTMLElement>("button, a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key !== "Tab" || !drawerRef.current) return;
      const f = drawerRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  const navLink = ({ href, label, Icon, buyerLabel }: (typeof NAV)[number]) => {
    const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 h-10 px-3 rounded-[var(--radius-sm)] text-sm transition",
          active ? "bg-primary-soft text-primary-soft-fg font-medium" : "text-muted hover:text-text hover:bg-surface-2",
        )}
      >
        <Icon className="size-[1.125rem] shrink-0" />
        {role === "buyer" && buyerLabel ? buyerLabel : label}
      </Link>
    );
  };
  const visible = NAV.filter((n) => !n.roles || n.roles.includes(role));
  const nav = (
    <nav aria-label="Platform" className="flex flex-col gap-0.5">
      {visible.filter((n) => !n.footer).map(navLink)}
    </nav>
  );
  const footerNav = <nav aria-label="Preferences" className="flex flex-col gap-0.5">{visible.filter((n) => n.footer).map(navLink)}</nav>;

  const roleCard = (
    <div className="rounded-[var(--radius-md)] p-3 bg-swarm-soft border border-border">
      <div className="text-[0.6875rem] uppercase tracking-wider text-subtle">Signed in as</div>
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
        <div className="mt-auto space-y-3">
          {footerNav}
          {roleCard}
        </div>
      </aside>
      {/* mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-[var(--overlay)] animate-[fade-in_var(--dur-fast)_ease-out]" onClick={() => setOpen(false)} />
          <div
            ref={drawerRef}
            id="app-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] bg-surface border-r border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col gap-6 overflow-y-auto animate-[drawer-in_var(--dur-med)_var(--ease-out)]"
          >
            <div className="flex items-center justify-between">
              <Link href="/" aria-label="SolarSwarm home">
                <Logo />
              </Link>
              <IconButton label="Close menu" size="sm" onClick={() => setOpen(false)}>
                <X className="size-4" />
              </IconButton>
            </div>
            {nav}
            <div className="mt-auto space-y-3">
              {footerNav}
              {roleCard}
            </div>
          </div>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 h-14 glass border-x-0 border-t-0 !border-b-border flex items-center gap-2 sm:gap-3 px-3 sm:px-6">
          <IconButton
            ref={menuButtonRef}
            label="Open menu"
            aria-expanded={open}
            aria-controls="app-drawer"
            className="lg:hidden shrink-0"
            onClick={() => setOpen(true)}
          >
            <MenuIcon className="size-5" />
          </IconButton>
          <Segmented
            className="hidden md:inline-flex shrink-0"
            size="sm"
            label="View as"
            value={role}
            onChange={setRole}
            options={(Object.keys(ROLE_META) as Role[]).map((r) => ({ value: r, label: ROLE_META[r].short }))}
          />
          <Select
            label="View as"
            hideLabel
            className="md:hidden shrink-0"
            renderValue={(o) => ROLE_COMPACT[o.value]}
            value={role}
            onChange={setRole}
            options={(Object.keys(ROLE_META) as Role[]).map((r) => ({ value: r, label: ROLE_META[r].short, description: ROLE_META[r].blurb }))}
          />
          <div className="ml-auto flex min-w-0 flex-1 md:flex-none items-center justify-end gap-1.5 sm:gap-2">
            <SitePicker className="min-w-0 flex-1 sm:flex-none sm:max-w-[16rem]" />
            <SimClock />
            <ThemeToggle className="hidden sm:inline-flex" />
            <AccountMenu />
          </div>
        </header>
        <main id="main" tabIndex={-1} className="px-3 sm:px-6 py-6 outline-none">
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
