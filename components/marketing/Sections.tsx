"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BatteryCharging,
  Brain,
  Building2,
  CalendarClock,
  Check,
  Cpu,
  Gauge,
  Handshake,
  Headset,
  MapPinned,
  Move3d,
  Radar,
  ShieldCheck,
  Sun,
  Truck,
  Wrench,
} from "lucide-react";
import { Stage } from "@/components/three/Stage";
import { Badge, BatteryGauge, Card, Segmented, Sparkline, StatusPill, buttonClass } from "@/components/ui";
import { fmt } from "@/lib/sim/energy";
import { PIPELINE, ROLE_META, SITES, sitesForRole, type Role } from "@/lib/sim/model";
import { liveRobots, siteDay, unitsAt } from "@/lib/sim/store";
import { cn } from "@/lib/cn";

const RobotViewer = dynamic(() => import("@/components/three/scenes/RobotViewer").then((m) => m.RobotViewer), {
  ssr: false,
});

function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-xs font-medium uppercase tracking-[0.18em] text-accent-text", className)}>{children}</p>
  );
}

/* ------------------------------------------------------------------ */
export function ProblemSection() {
  const rows = [
    ["Time to energize (20 MW)", "3–5 months for racking alone", "Days per array block"],
    ["People on site", "200+ across trades", "A crew of 3 + the swarm"],
    ["Groundwork", "Piles, trenching, concrete", "None. Drives onto existing ground"],
    ["Tracking", "Fixed tilt or 1-axis", "Dual-axis per panel"],
    ["Site changes", "Permanent", "Re-forms, relocates, redeploys"],
  ];
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 grid gap-12 lg:grid-cols-2 items-center">
        <div>
          <Eyebrow>Why SolarSwarm</Eyebrow>
          <h2 className="mt-3 text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
            Solar shouldn&apos;t take a construction project.
          </h2>
          <p className="mt-5 text-lg text-muted max-w-lg">
            Today a utility-scale field is months of manual labor: racking, cabling, coordinating hundreds of
            workers. SolarSwarm turns the array into a fleet of robots that install themselves where the power
            is needed.
          </p>
          <div className="mt-8 rounded-[var(--radius-lg)] border border-border overflow-hidden">
            <div className="grid grid-cols-[1.1fr_1fr_1fr] text-xs uppercase tracking-wide bg-surface-2 text-muted">
              <div className="px-4 py-3" />
              <div className="px-4 py-3">Traditional</div>
              <div className="px-4 py-3 text-primary font-semibold">SolarSwarm</div>
            </div>
            {rows.map(([k, a, b]) => (
              <div key={k} className="grid grid-cols-[1.1fr_1fr_1fr] text-sm border-t border-border bg-surface">
                <div className="px-4 py-3.5 font-medium">{k}</div>
                <div className="px-4 py-3.5 text-muted">{a}</div>
                <div className="px-4 py-3.5 flex gap-2">
                  <Check className="size-4 text-primary shrink-0 mt-0.5" />
                  {b}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative aspect-[4/3] rounded-[var(--radius-xl)] overflow-hidden shadow-lg">
          <Image
            src="/renders/array.jpg"
            alt="Aerial view of a deployed SolarSwarm array at golden hour"
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
          <div className="absolute left-4 bottom-4 glass rounded-[var(--radius-md)] px-4 py-3 text-sm">
            <div className="font-mono tabular text-xl font-semibold">468 units</div>
            <div className="text-muted text-xs">190 kW array · deployed in 2 days</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
const ANATOMY = [
  { Icon: Sun, t: "Dual-axis gimbal", d: "±60° tilt and 360° azimuth, following the real solar ephemeris." },
  { Icon: Move3d, t: "Telescoping mast", d: "Raises the panel above crops and brush, stows low for transport and wind." },
  { Icon: Radar, t: "LiDAR + stereo vision", d: "Centimeter positioning, obstacle avoidance and row spacing on uneven ground." },
  { Icon: BatteryCharging, t: "5 kWh LFP pack", d: "Drives itself and buffers energy. The site's distributed battery." },
  { Icon: Truck, t: "All-terrain drive", d: "Four hub motors and lugged tires for dirt, gravel and grass." },
  { Icon: Cpu, t: "Swarm OS", d: "Mesh networking, OTA updates and on-device health monitoring." },
];

export function RobotSection() {
  return (
    <section id="robot" className="py-24 sm:py-32 bg-surface border-y border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr] items-center">
          <div className="relative rounded-[var(--radius-xl)] overflow-hidden aspect-square sm:aspect-[5/4] bg-[#0e0c14] shadow-lg">
            <Stage
              poster="/renders/studio.jpg"
              posterAlt="SolarSwarm unit in a studio"
              className="absolute inset-0"
              camera={{ position: [3.2, 1.7, 3.4], fov: 35, near: 0.1, far: 100 }}
              ao={false}
            >
              <RobotViewer />
            </Stage>
            <div className="absolute top-4 left-4 flex gap-2">
              <Badge tone="primary" className="!bg-white/10 !text-white backdrop-blur">
                Drag to orbit
              </Badge>
            </div>
          </div>
          <div>
            <Eyebrow>The unit</Eyebrow>
            <h2 className="mt-3 text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
              A power plant that parks itself.
            </h2>
            <p className="mt-5 text-lg text-muted">
              Each SolarSwarm unit is a self-contained 410 W tracker on wheels: panel, gimbal, battery, compute and
              sensors in one rugged chassis.
            </p>
            <div className="mt-8 grid sm:grid-cols-2 gap-x-6 gap-y-6">
              {ANATOMY.map(({ Icon, t, d }) => (
                <div key={t} className="flex gap-3">
                  <span className="size-9 shrink-0 rounded-[var(--radius-sm)] bg-primary-soft text-primary-soft-fg grid place-items-center">
                    <Icon className="size-[18px]" />
                  </span>
                  <div>
                    <div className="font-medium text-[15px]">{t}</div>
                    <p className="text-sm text-muted mt-0.5">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

function usePreviewData(role: Role) {
  const mounted = useMounted();
  return useMemo(() => {
    if (!mounted) return null;
    const now = Date.now();
    const sites = sitesForRole(role);
    const days = sites.map((s) => ({ site: s, day: siteDay(s, now) }));
    const energy = days.reduce((a, d) => a + d.day.solarKwh, 0);
    const load = days.reduce((a, d) => a + d.day.loadKwh, 0);
    const imp = days.reduce((a, d) => a + d.day.importKwh, 0);
    const savings = days.reduce((a, d) => a + (d.day.solarKwh - d.day.exportKwh) * (0.19 - (d.site.contract === "ppa" ? d.site.tariff : 0)), 0);
    const units = sites.reduce((a, s) => a + unitsAt(s.id).length, 0);
    const spark = days[0]?.day.points.filter((_, i) => i % 3 === 0).map((p) => p.solarKw) ?? [];
    const live = sites.flatMap((s) => liveRobots(s, now));
    const predicted = live.filter((r) => r.unit.prediction);
    const risks = [...predicted]
      .sort((a, b) => b.unit.risk - a.unit.risk)
      .slice(0, 3);
    const available = live.filter((r) => r.status !== "fault" && r.status !== "docked").length / live.length;
    const mrr = sites.reduce((a, s) => a + unitsAt(s.id).length * (s.leaseRate || 31), 0);
    return { sites, energy, load, imp, savings, units, spark, risks, predicted: predicted.length, available, mrr };
  }, [mounted, role]);
}

function PreviewFrame({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle: string }) {
  return (
    <Card className="overflow-hidden shadow-lg">
      <div className="flex items-center gap-2 h-10 px-4 border-b border-border bg-surface-2">
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="ml-3 text-xs text-muted truncate">app.solarswarm.io · {title}</span>
      </div>
      <div className="p-5">
        <div className="text-xs text-muted">{subtitle}</div>
        {children}
      </div>
    </Card>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-surface-2 p-3 min-w-0">
      <div className="text-[11px] text-muted truncate">{label}</div>
      <div className="font-mono tabular text-lg font-semibold mt-0.5 truncate">{value}</div>
      {sub && <div className="text-[11px] text-subtle truncate">{sub}</div>}
    </div>
  );
}

const AUDIENCES: Record<
  Role,
  { Icon: typeof Building2; title: string; pitch: string; points: string[] }
> = {
  buyer: {
    Icon: Building2,
    title: "For those who buy or rent power",
    pitch:
      "Farms, water districts and cold-storage sites get on-site solar without a construction project, and one screen for output, savings and service.",
    points: ["Live output and savings vs. your utility rate", "Monthly statements & PPA billing", "Service status and scheduled visits", "Request more units or relocate rows"],
  },
  lessor: {
    Icon: Handshake,
    title: "For those who sell or lease fleets",
    pitch:
      "Asset owners deploy robots across many customers and see utilization, revenue and lease health in one portfolio view.",
    points: ["Fleet utilization & revenue per unit", "Lease pipeline from survey to deploy", "Redeploy idle units to new contracts", "Covenant-ready production reports"],
  },
  ops: {
    Icon: Headset,
    title: "SolarSwarm Ops: the business layer",
    pitch:
      "Our operations team runs every fleet: predictive maintenance, remote support, dispatch and firmware, so owners and lessors never have to.",
    points: ["Predictive failure detection per component", "Remote diagnostics & OTA firmware", "Spare-unit dispatch and field-tech routing", "SLA & uptime tracking across customers"],
  },
};

export function AudienceSection() {
  const [role, setRole] = useState<Role>("buyer");
  const a = AUDIENCES[role];
  const d = usePreviewData(role);
  return (
    <section id="platform" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <Eyebrow>One platform, every side of the deal</Eyebrow>
          <h2 className="mt-3 text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
            Built for the people who use the power, own the fleet, and keep it running.
          </h2>
        </div>
        <Segmented
          className="mt-10"
          value={role}
          onChange={setRole}
          options={(Object.keys(AUDIENCES) as Role[]).map((r) => ({ value: r, label: ROLE_META[r].short }))}
        />
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_1.15fr] items-start">
          <div>
            <div className="size-11 rounded-[var(--radius-md)] bg-swarm text-white grid place-items-center shadow-glow">
              <a.Icon className="size-5" />
            </div>
            <h3 className="mt-5 text-2xl font-semibold tracking-tight">{a.title}</h3>
            <p className="mt-3 text-muted">{a.pitch}</p>
            <ul className="mt-6 space-y-3">
              {a.points.map((p) => (
                <li key={p} className="flex gap-3 text-[15px]">
                  <span className="size-5 rounded-full bg-accent-soft text-accent-soft-fg grid place-items-center shrink-0 mt-0.5">
                    <Check className="size-3" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
            <Link
              href={`/app?role=${role}`}
              className={buttonClass("outline", "md", "mt-8")}
            >
              Open the {ROLE_META[role].short} view <ArrowRight className="size-4" />
            </Link>
          </div>

          {role === "buyer" && (
            <PreviewFrame title="Overview" subtitle="Red Mesa Water District · 2 sites">
              <div className="mt-3 grid grid-cols-3 gap-3">
                <MiniStat label="Solar today" value={d ? fmt.kwh(d.energy) : "—"} />
                <MiniStat label="Savings today" value={d ? fmt.usd(d.savings) : "—"} />
                <MiniStat label="Self-supplied" value={d ? fmt.pct(1 - d.imp / d.load, 0) : "—"} />
              </div>
              <div className="mt-4 rounded-[var(--radius-md)] border border-border p-3">
                <div className="flex justify-between text-xs text-muted">
                  <span>Output today · {SITES[0].name}</span>
                  <span className="font-mono">kW</span>
                </div>
                {d && <Sparkline data={d.spark} className="w-full h-20 mt-2" />}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-[var(--radius-md)] bg-success-soft px-3 py-2.5 text-sm">
                <span className="flex items-center gap-2 text-success font-medium">
                  <ShieldCheck className="size-4" /> All systems normal
                </span>
                <span className="text-xs text-muted flex items-center gap-1">
                  <CalendarClock className="size-3.5" /> Panel wash Thu
                </span>
              </div>
            </PreviewFrame>
          )}
          {role === "lessor" && (
            <PreviewFrame title="Portfolio" subtitle="Helio Capital Partners · fleet portfolio">
              <div className="mt-3 grid grid-cols-3 gap-3">
                <MiniStat label="Units deployed" value={d ? fmt.int(d.units) : "—"} />
                <MiniStat label="Availability" value={d ? fmt.pct(d.available) : "—"} />
                <MiniStat label="Lease MRR" value={d ? fmt.usd(d.mrr) : "—"} />
              </div>
              <div className="mt-4 text-xs text-muted">Lease pipeline</div>
              <div className="mt-2 divide-y divide-border rounded-[var(--radius-md)] border border-border">
                {PIPELINE.slice(0, 4).map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <span className="truncate">{p.customer}</span>
                    <span className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-xs text-muted">{p.units} units</span>
                      <Badge tone={p.stage === "Deploying" ? "primary" : p.stage === "Contract" ? "copper" : "neutral"}>
                        {p.stage}
                      </Badge>
                    </span>
                  </div>
                ))}
              </div>
            </PreviewFrame>
          )}
          {role === "ops" && (
            <PreviewFrame title="Predictive maintenance" subtitle="SolarSwarm Ops · all fleets">
              <div className="mt-3 grid grid-cols-3 gap-3">
                <MiniStat label="Units managed" value={d ? fmt.int(d.units) : "—"} />
                <MiniStat label="Fleet availability" value={d ? fmt.pct(d.available) : "—"} />
                <MiniStat label="Predicted issues" value={d ? String(d.predicted) : "—"} sub="next 30 days" />
              </div>
              <div className="mt-4 text-xs text-muted">Highest risk units</div>
              <div className="mt-2 space-y-2">
                {d?.risks.map((r) => (
                  <div key={r.unit.id} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium flex items-center gap-2">
                        {r.unit.id}
                        <StatusPill status={r.status} />
                      </div>
                      <div className="text-xs text-muted truncate">
                        {r.unit.prediction?.component} ·{" "}
                        {r.unit.prediction?.days === 0 ? "failed" : `~${r.unit.prediction?.days} days`} ·{" "}
                        {fmt.pct(r.unit.prediction?.confidence ?? 0, 0)} confidence
                      </div>
                    </div>
                    <BatteryGauge value={r.soc * 100} className="w-24" />
                  </div>
                ))}
              </div>
            </PreviewFrame>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
export function OpsSection() {
  const features = [
    { Icon: Brain, t: "Predictive maintenance", d: "Motor temperature, bearing vibration, actuator current and soiling feed per-component failure forecasts, so parts ship before anything breaks." },
    { Icon: MapPinned, t: "Every fleet on one map", d: "Open-source mapping with satellite imagery: every site, row and robot, live." },
    { Icon: Wrench, t: "Dispatch & self-healing", d: "A faulted unit drives itself to the service lane while a spare takes its slot." },
    { Icon: Activity, t: "Energy in and out", d: "Generation, storage, site load and grid export reconciled for billing and settlement." },
    { Icon: Headset, t: "Support built in", d: "Customers open tickets from the app; Ops sees the unit's full telemetry alongside." },
    { Icon: Gauge, t: "SLA & uptime", d: "Availability guarantees tracked per contract, with automatic credits." },
  ];
  return (
    <section id="ops" className="relative overflow-hidden bg-violet-950 text-white py-24 sm:py-32">
      <Image src="/renders/satellite.jpg" alt="" fill sizes="100vw" className="object-cover opacity-35" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgb(91_43_217/0.55),transparent_60%),linear-gradient(180deg,rgb(20_6_47/0.6),rgb(20_6_47/0.92))]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <Eyebrow className="text-copper-300">SolarSwarm Ops</Eyebrow>
          <h2 className="mt-3 text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
            The business that keeps every swarm running.
          </h2>
          <p className="mt-5 text-lg text-white/70">
            Behind every customer and every lessor, SolarSwarm operates the fleet: monitoring, maintenance,
            support and redeployment as a service.
          </p>
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ Icon, t, d }) => (
            <div key={t} className="rounded-[var(--radius-lg)] p-6 bg-white/[0.06] border border-white/10 backdrop-blur-sm">
              <Icon className="size-5 text-copper-300" />
              <div className="mt-4 font-medium">{t}</div>
              <p className="mt-1.5 text-sm text-white/65">{d}</p>
            </div>
          ))}
        </div>
        <Link href="/app?role=ops" className={buttonClass("copper", "lg", "mt-12")}>
          Explore the Ops console <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
export function GallerySection() {
  const shots = [
    { src: "/renders/formation.jpg", alt: "Robots queuing into formation rows", cap: "Queuing into formation", span: "sm:col-span-2 sm:row-span-2" },
    { src: "/renders/detail_sensor.jpg", alt: "Close-up of LiDAR, stereo cameras and LED bar", cap: "LiDAR + stereo vision", span: "" },
    { src: "/renders/detail_wheel.jpg", alt: "Close-up of the all-terrain wheel with copper hub", cap: "All-terrain hub drive", span: "" },
    { src: "/renders/onboarding.jpg", alt: "Robots rolling off a truck through the pairing portal", cap: "Offloading at the portal", span: "sm:col-span-2" },
    { src: "/renders/satellite.jpg", alt: "Top-down view of a fenced array with inverter pad", cap: "Site from above", span: "" },
  ];
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Eyebrow>In the field</Eyebrow>
        <h2 className="mt-3 text-3xl sm:text-5xl font-semibold tracking-tight">Rugged, ready and scalable.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-3 auto-rows-[220px] sm:auto-rows-[240px]">
          {shots.map((s) => (
            <figure key={s.src} className={cn("group relative overflow-hidden rounded-[var(--radius-lg)] bg-surface-2", s.span)}>
              <Image src={s.src} alt={s.alt} fill sizes="(min-width: 640px) 66vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
              <figcaption className="absolute left-3 bottom-3 glass rounded-full px-3 py-1 text-xs">{s.cap}</figcaption>
            </figure>
          ))}
        </div>
        <dl className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            ["410 W", "per unit, monocrystalline"],
            ["IP67", "sealed drive & electronics"],
            ["55 mph", "wind stow rating"],
            ["±15°", "slope capability"],
          ].map(([v, l]) => (
            <div key={l} className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
              <dt className="sr-only">{l}</dt>
              <dd className="font-mono tabular text-3xl font-semibold text-copper">{v}</dd>
              <dd className="text-sm text-muted mt-1">{l}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
export function CtaSection() {
  return (
    <section className="px-4 sm:px-6 pb-24">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[var(--radius-xl)] bg-swarm text-white px-6 sm:px-14 py-16 sm:py-20 shadow-glow">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-[radial-gradient(circle,rgb(224_163_106/0.55),transparent_65%)]" />
        <div className="relative max-w-2xl">
          <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
            Power on site next month, not next year.
          </h2>
          <p className="mt-4 text-lg text-white/75">
            Tell us about your site. We&apos;ll survey it from satellite imagery and propose a swarm size, lease or
            PPA within a week.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/app/onboarding" className={buttonClass("copper", "lg")}>
              Plan a deployment <ArrowRight className="size-4" />
            </Link>
            <Link href="/app" className={buttonClass("ghost", "lg", "text-white border border-white/25 hover:bg-white/10")}>
              Tour the platform
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
