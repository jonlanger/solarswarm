"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, MapPin, PartyPopper, QrCode, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/app/AppShell";
import { Panel } from "@/components/app/widgets";
import { FleetMapLazy } from "@/components/map/FleetMapLazy";
import { Stage } from "@/components/three/Stage";
import { Badge, Button, Card, Segmented, Stepper, buttonClass } from "@/components/ui";
import { fmt, simulateDay } from "@/lib/sim/energy";
import { ORGS, ROLE_META, SITES, commissionSite, offsetLatLon, type Site } from "@/lib/sim/model";
import { useSim } from "@/lib/sim/store";
import { cn } from "@/lib/cn";

const DeployScene = dynamic(() => import("@/components/three/scenes/DeployScene").then((m) => m.DeployScene), {
  ssr: false,
});

const STEPS = ["Register units", "Choose site", "Plan layout", "Deploy & commission"];

export default function OnboardingPage() {
  const role = useSim((s) => s.role);
  const addRobots = useSim((s) => s.addRobots);
  const setSite = useSim((s) => s.setSite);
  const [step, setStep] = useState(0);

  // 1 · units
  const [count, setCount] = useState(48);
  const [paired, setPaired] = useState(0);
  const serials = useMemo(() => Array.from({ length: count }, (_, i) => `SS-${30100 + i}`), [count]);
  useEffect(() => {
    if (step !== 0 || paired === 0 || paired >= count) return;
    const id = setTimeout(() => setPaired((p) => Math.min(count, p + Math.ceil(count / 24))), 90);
    return () => clearTimeout(id);
  }, [paired, count, step]);

  // 2 · site
  const [mode, setMode] = useState<"extend" | "new">("new");
  const [baseSite, setBaseSite] = useState(SITES[0].id);
  const [picked, setPicked] = useState<[number, number] | undefined>([-117.735, 34.9505]);
  const [name, setName] = useState("Barstow Logistics Yard");
  const [owner, setOwner] = useState(ORGS.find((o) => o.kind === "buyer")!.id);

  // 3 · layout
  const [cols, setCols] = useState(8);
  const [pitchX, setPitchX] = useState(2.4);
  const [pitchY, setPitchY] = useState(3.2);
  const rows = Math.ceil(count / cols);

  const draftSite: Site = useMemo(() => {
    const base = SITES.find((s) => s.id === baseSite)!;
    const [lat, lon] =
      mode === "extend" ? offsetLatLon(base.lat, base.lon, 95, 0) : [picked?.[1] ?? 35, picked?.[0] ?? -117];
    return {
      id: `site-${Date.now().toString(36)}`,
      name: mode === "extend" ? `${base.name} · Block B` : name || "New site",
      region: mode === "extend" ? base.region : "San Bernardino County, CA",
      lat,
      lon,
      heading: 0,
      rows,
      cols,
      pitchX,
      pitchY,
      ownerId: mode === "extend" ? base.ownerId : owner,
      lessorId: ROLE_META[role].orgId && role === "lessor" ? ROLE_META[role].orgId! : "org-helio",
      contract: "lease",
      tariff: 0.16,
      leaseRate: 36,
      commissioned: new Date().toISOString().slice(0, 10),
      loadKw: count * 0.18,
      storageKwh: count * 5,
      timezone: "America/Los_Angeles",
    };
  }, [mode, baseSite, picked, name, owner, rows, cols, pitchX, pitchY, role, count]);

  const estimate = useMemo(() => simulateDay(draftSite, new Date(), count), [draftSite, count]);

  // 4 · deploy
  const progress = useRef(0);
  const [deployPct, setDeployPct] = useState(0);
  const [commissioned, setCommissioned] = useState<Site | null>(null);
  useEffect(() => {
    if (step !== 3 || commissioned) return;
    progress.current = 0;
    const start = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      const p = Math.min(1, (t - start) / 26000);
      progress.current = p;
      setDeployPct(p);
      if (p < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [step, commissioned]);

  const commission = () => {
    const units = commissionSite(draftSite);
    addRobots(units);
    setSite("all");
    setCommissioned(draftSite);
  };

  const canNext = step === 0 ? paired >= count : step === 1 ? mode === "extend" || !!picked : true;
  const footprint = cols * pitchX * rows * pitchY;

  return (
    <>
      <PageHeader title="Onboard robots" subtitle="Register new units, pick a site, plan the formation and deploy." />
      <Card className="p-4 sm:p-5 mb-4">
        <Stepper steps={STEPS} current={step} />
      </Card>

      {step === 0 && (
        <Panel
          title="Register & pair units"
          subtitle="Scan the delivery manifest. Each unit authenticates and syncs firmware as it rolls through the portal."
        >
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-sm">
              <span className="block text-muted mb-1.5">Units on this truck</span>
              <input
                type="number"
                min={8}
                max={96}
                value={count}
                onChange={(e) => {
                  setCount(Math.max(8, Math.min(96, Number(e.target.value) || 8)));
                  setPaired(0);
                }}
                className="h-10 w-28 px-3 rounded-[var(--radius-sm)] border border-border bg-surface font-mono"
              />
            </label>
            <Button onClick={() => setPaired(1)} disabled={paired > 0}>
              <QrCode className="size-4" /> {paired === 0 ? "Scan manifest & pair" : paired < count ? "Pairing…" : "All paired"}
            </Button>
            <div className="text-sm text-muted ml-auto font-mono">
              {paired}/{count} paired
            </div>
          </div>
          <div className="mt-5 grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-12 gap-1.5">
            {serials.map((s, i) => (
              <div
                key={s}
                className={cn(
                  "rounded-[6px] px-1.5 py-1 text-[10.5px] font-mono text-center border transition-colors",
                  i < paired ? "bg-primary-soft border-primary/40 text-primary-soft-fg" : "bg-accent-soft/50 border-border text-muted",
                )}
                title={i < paired ? "Paired" : "Awaiting pairing"}
              >
                {s.slice(3)}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            <span className="inline-block size-2 rounded-full bg-accent mr-1.5" />
            copper = unpaired · <span className="inline-block size-2 rounded-full bg-primary mx-1.5" />
            violet = paired &amp; on the site mesh
          </p>
        </Panel>
      )}

      {step === 1 && (
        <div className="grid gap-4 xl:grid-cols-[1fr_1.6fr]">
          <Panel title="Where are they going?">
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: "new", label: "New site" },
                { value: "extend", label: "Extend existing site" },
              ]}
            />
            {mode === "new" ? (
              <div className="mt-5 space-y-4 text-sm">
                <label className="block">
                  <span className="block text-muted mb-1.5">Site name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="h-10 w-full px-3 rounded-[var(--radius-sm)] border border-border bg-surface" />
                </label>
                <label className="block">
                  <span className="block text-muted mb-1.5">Customer (site owner)</span>
                  <select value={owner} onChange={(e) => setOwner(e.target.value)} className="h-10 w-full px-2 rounded-[var(--radius-sm)] border border-border bg-surface">
                    {ORGS.filter((o) => o.kind === "buyer").map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="rounded-[var(--radius-md)] bg-surface-2 p-3 flex gap-3">
                  <MapPin className="size-4 text-accent mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">Click the map to place the array</div>
                    <div className="text-xs text-muted font-mono mt-0.5">
                      {picked ? `${picked[1].toFixed(5)}, ${picked[0].toFixed(5)}` : "No location yet"}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <label className="mt-5 block text-sm">
                <span className="block text-muted mb-1.5">Site</span>
                <select value={baseSite} onChange={(e) => setBaseSite(e.target.value)} className="h-10 w-full px-2 rounded-[var(--radius-sm)] border border-border bg-surface">
                  {SITES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <span className="block text-xs text-muted mt-2">A new block will be placed 95 m east of the existing array.</span>
              </label>
            )}
          </Panel>
          <Card className="overflow-hidden min-h-[440px]">
            <FleetMapLazy
              className="h-[440px]"
              sites={mode === "extend" ? [SITES.find((s) => s.id === baseSite)!] : SITES}
              robots={[]}
              summary={{}}
              focusSiteId={mode === "extend" ? baseSite : undefined}
              onPick={mode === "new" ? setPicked : undefined}
              picked={mode === "new" ? picked : [draftSite.lon, draftSite.lat]}
            />
          </Card>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
          <Panel title="Formation" subtitle="The swarm spaces itself to avoid row-to-row shading at low sun.">
            <div className="space-y-5 text-sm">
              <Slider label="Units per row" value={cols} min={4} max={16} step={1} onChange={setCols} fmt={(v) => `${v} (${rows} rows)`} />
              <Slider label="Spacing across (m)" value={pitchX} min={2} max={3.5} step={0.1} onChange={setPitchX} fmt={(v) => `${v.toFixed(1)} m`} />
              <Slider label="Row pitch (m)" value={pitchY} min={2.6} max={5} step={0.1} onChange={setPitchY} fmt={(v) => `${v.toFixed(1)} m`} />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Est label="Array capacity" value={fmt.kw((count * 410) / 1000)} />
              <Est label="Footprint" value={`${fmt.int(footprint)} m²`} />
              <Est label="Est. energy today" value={fmt.kwh(estimate.solarKwh)} />
              <Est label="Tracking gain" value={`+${Math.round(estimate.trackingGain * 100)}%`} />
            </div>
          </Panel>
          <Panel title="Layout preview" subtitle={`${draftSite.name} · ${rows} × ${cols}`}>
            <LayoutPreview rows={rows} cols={cols} count={count} pitchX={pitchX} pitchY={pitchY} />
          </Panel>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <Card className="overflow-hidden relative h-[520px] bg-violet-950">
            <Stage eager className="absolute inset-0" camera={{ position: [11, 2.4, 21], fov: 40, near: 0.1, far: 6000 }}>
              <DeployScene progress={progress} />
            </Stage>
            <div className="absolute left-4 right-4 bottom-4 glass rounded-[var(--radius-md)] px-4 py-3">
              <div className="flex justify-between text-sm">
                <span>
                  {deployPct < 0.13
                    ? "Truck arriving · ramp down"
                    : deployPct < 0.7
                      ? "Units pairing at portal & driving to slots"
                      : deployPct < 0.8
                        ? "Raising masts, unlocking panels"
                        : "Tracking the sun"}
                </span>
                <span className="font-mono tabular">{Math.round(deployPct * 100)}%</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <div className="h-full bg-swarm" style={{ width: `${deployPct * 100}%` }} />
              </div>
            </div>
          </Card>
          <Panel title={commissioned ? "Commissioned" : "Ready to commission"}>
            {commissioned ? (
              <div className="text-sm space-y-4">
                <div className="flex items-center gap-2 text-success font-medium">
                  <PartyPopper className="size-5" /> {count} units are live at {commissioned.name}
                </div>
                <p className="text-muted">
                  They&apos;re now in the fleet map, robot list, energy reports and predictive-maintenance models.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/app/map" className={buttonClass("primary", "md")}>
                    See them on the map <ArrowRight className="size-4" />
                  </Link>
                  <Link href="/app/robots" className={buttonClass("outline", "md")}>
                    Robot list
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-sm space-y-3">
                <Row k="Units" v={`${count} paired`} />
                <Row k="Site" v={draftSite.name} />
                <Row k="Formation" v={`${rows} rows × ${cols} · ${pitchX.toFixed(1)} × ${pitchY.toFixed(1)} m`} />
                <Row k="Capacity" v={fmt.kw((count * 410) / 1000)} />
                <Row k="Contract" v={<Badge tone="copper">Lease · $36/unit/mo</Badge>} />
                <Button className="w-full mt-2" size="lg" disabled={deployPct < 1} onClick={commission}>
                  <CheckCircle2 className="size-4" /> {deployPct < 1 ? "Deploying…" : "Commission array"}
                </Button>
                <p className="text-xs text-muted">The preview shows the first 48 units of the formation.</p>
              </div>
            )}
          </Panel>
        </div>
      )}

      <div className="mt-4 flex justify-between">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || !!commissioned}>
          <ArrowLeft className="size-4" /> Back
        </Button>
        {step < 3 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
            Continue <ArrowRight className="size-4" />
          </Button>
        ) : (
          commissioned && (
            <Button
              variant="outline"
              onClick={() => {
                setStep(0);
                setPaired(0);
                setCommissioned(null);
              }}
            >
              <RotateCcw className="size-4" /> Onboard another truck
            </Button>
          )
        )}
      </div>
    </>
  );
}

function Slider({ label, value, min, max, step, onChange, fmt: f }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <label className="block">
      <span className="flex justify-between mb-1.5">
        <span className="text-muted">{label}</span>
        <span className="font-mono tabular">{f(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--primary)] cursor-pointer" />
    </label>
  );
}

function Est({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-surface-2 p-3">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="font-mono tabular font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1 border-b border-border last:border-0">
      <span className="text-muted">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}

function LayoutPreview({ rows, cols, count, pitchX, pitchY }: { rows: number; cols: number; count: number; pitchX: number; pitchY: number }) {
  const W = cols * pitchX + 6;
  const H = rows * pitchY + 6;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-h-[420px] rounded-[var(--radius-md)] bg-surface-2">
      <rect x={1} y={1} width={W - 2} height={H - 2} fill="none" stroke="var(--primary)" strokeDasharray="0.8 0.6" strokeWidth={0.12} rx={0.6} />
      {Array.from({ length: count }, (_, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const x = 3 + c * pitchX + pitchX / 2;
        const y = 3 + r * pitchY + pitchY / 2;
        return (
          <g key={i} transform={`translate(${x} ${y})`}>
            <rect x={-0.5} y={-0.82} width={1} height={1.65} rx={0.06} fill="var(--chart-1)" opacity={0.85} />
            <rect x={-0.3} y={-0.55} width={0.6} height={1.1} rx={0.12} fill="none" stroke="var(--accent)" strokeWidth={0.06} />
          </g>
        );
      })}
      <text x={W - 1.5} y={H - 1.5} textAnchor="end" fontSize={0.9} fill="var(--text-subtle)">
        N ↑ · {(cols * pitchX).toFixed(0)} × {(rows * pitchY).toFixed(0)} m
      </text>
    </svg>
  );
}
