"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CircleCheck,
  MapPin,
  PartyPopper,
  PenLine,
  QrCode,
  RotateCcw,
  Sparkles,
  TriangleAlert,
  Undo2,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/app/AppShell";
import { Panel } from "@/components/app/widgets";
import { FleetMapLazy } from "@/components/map/FleetMapLazy";
import type { MapperInfra, MapperSlot } from "@/components/map/SiteMapper";
import { Stage } from "@/components/three/Stage";
import { Badge, Button, Card, Segmented, Select, Stepper, buttonClass } from "@/components/ui";
import { fmt, simulateDay } from "@/lib/sim/energy";
import {
  INFRA,
  centroid,
  dist,
  gridSlots,
  longestEdgeAngle,
  pickSlots,
  placeInfra,
  polygonArea,
  slotBlocked,
  suggestInfra,
  toLngLat,
  toLocal,
  type InfraKind,
  type LngLat,
  type Placed,
  type XY,
} from "@/lib/sim/layout";
import { ORGS, ROLE_META, SITES, commissionSite, offsetLatLon, type Site } from "@/lib/sim/model";
import { useSim } from "@/lib/sim/store";
import { cn } from "@/lib/cn";

const DeployScene = dynamic(() => import("@/components/three/scenes/DeployScene").then((m) => m.DeployScene), {
  ssr: false,
});
const SiteMapper = dynamic(() => import("@/components/map/SiteMapper").then((m) => m.SiteMapper), {
  ssr: false,
  loading: () => <div className="size-full bg-surface-2 animate-pulse" />,
});

const STEPS = ["Choose site", "Map & size", "Register units", "Place infrastructure", "Deploy & commission"];
const LEASE = 36; // $/unit/mo
const SETBACK = 3; // m from the fence

/** A roughly 110 × 75 m lot with one clipped corner, around a point — for demos when you don't want to trace. */
function sampleLot(c: LngLat): LngLat[] {
  const pts: XY[] = [
    [-58, -34],
    [52, -40],
    [58, 22],
    [30, 40],
    [-54, 36],
  ];
  return pts.map((p) => toLngLat(c, p));
}

export default function OnboardingPage() {
  const role = useSim((s) => s.role);
  const addRobots = useSim((s) => s.addRobots);
  const setSite = useSim((s) => s.setSite);
  const [step, setStep] = useState(0);
  const [siteId] = useState(() => `site-${Date.now().toString(36)}`);

  // 1 · site
  const [mode, setMode] = useState<"extend" | "new">("new");
  const [baseSite, setBaseSite] = useState(SITES[0].id);
  const [picked, setPicked] = useState<[number, number] | undefined>([-117.735, 34.9505]);
  const [name, setName] = useState("Barstow Logistics Yard");
  const [owner, setOwner] = useState(ORGS.find((o) => o.kind === "buyer")!.id);

  const origin: LngLat = useMemo(() => {
    if (mode === "new") return picked ?? [-117, 35];
    const b = SITES.find((s) => s.id === baseSite)!;
    const [lat, lon] = offsetLatLon(b.lat, b.lon, 95, 0);
    return [lon, lat];
  }, [mode, picked, baseSite]);

  // 2 · perimeter + sizing
  const [perimeter, setPerimeter] = useState<LngLat[]>([]);
  const [closed, setClosed] = useState(false);
  const [pitchX, setPitchX] = useState(2.4);
  const [pitchY, setPitchY] = useState(3.2);
  const [align, setAlign] = useState<"edge" | "ns">("edge");
  const [road, setRoad] = useState<LngLat | null>(null);
  const [count, setCount] = useState(0);
  const [budget, setBudget] = useState(3000);
  const onPerimeter = useCallback((pts: LngLat[], c: boolean) => {
    setPerimeter(pts);
    setClosed(c);
  }, []);
  const resetFence = () => {
    setPerimeter([]);
    setClosed(false);
    setMoved({});
  };
  // a new location invalidates the fence
  const lastOrigin = useRef(origin.join());
  useEffect(() => {
    if (lastOrigin.current === origin.join()) return;
    lastOrigin.current = origin.join();
    resetFence();
    setRoad(null);
  }, [origin]);

  // 4 · infrastructure (user overrides of the suggestion, in local metres)
  const [moved, setMoved] = useState<Partial<Record<InfraKind, XY>>>({});

  const plan = useMemo(() => {
    const poly = perimeter.map((p) => toLocal(origin, p));
    if (!closed || poly.length < 3) return null;
    const angle = align === "edge" ? longestEdgeAngle(poly) : 0;
    const grid = gridSlots(poly, { pitchX, pitchY, setback: SETBACK, angle });
    if (!grid.length) return { poly, grid, area: polygonArea(poly), open: [], infra: null };
    const suggested = suggestInfra(poly, grid.map((g) => g.p), road ? toLocal(origin, road) : undefined);
    const dropoff = moved.dropoff ? placeInfra(poly, "dropoff", moved.dropoff) : suggested.dropoff;
    const swap = moved.swap ? placeInfra(poly, "swap", moved.swap) : suggested.swap;
    const placed = [dropoff, swap];
    const open = grid.map((g, i) => i).filter((i) => !slotBlocked(grid[i].p, placed));
    return { poly, grid, area: polygonArea(poly), open, infra: { dropoff, swap, suggested } };
  }, [perimeter, closed, origin, align, pitchX, pitchY, road, moved]);

  const capacity = plan?.open.length ?? 0;
  const units = Math.min(count, capacity);
  const affordable = Math.floor(budget / LEASE);
  // default the order to what the budget covers the first time a fence closes
  useEffect(() => {
    if (capacity && count === 0) setCount(Math.max(1, Math.min(capacity, affordable)));
  }, [capacity, count, affordable]);

  // fill the slots nearest the swap container so battery runs stay short
  const chosen = useMemo(() => {
    if (!plan?.infra) return [] as number[];
    const open = plan.open.map((i) => plan.grid[i].p);
    return pickSlots(open, units, plan.infra.swap.center).map((k) => plan.open[k]);
  }, [plan, units]);

  const center: XY = useMemo(() => (plan ? centroid(plan.poly) : [0, 0]), [plan]);
  const siteLngLat = toLngLat(origin, center);

  const draftSite: Site = useMemo(() => {
    const base = SITES.find((s) => s.id === baseSite)!;
    const slots = chosen.map((i) => {
      const g = plan!.grid[i];
      return { dx: g.p[0] - center[0], dy: g.p[1] - center[1], row: g.row, col: g.col };
    });
    const rows = new Set(slots.map((s) => s.row)).size;
    return {
      id: siteId,
      name: mode === "extend" ? `${base.name} · Block B` : name || "New site",
      region: mode === "extend" ? base.region : "San Bernardino County, CA",
      lat: siteLngLat[1],
      lon: siteLngLat[0],
      heading: 0,
      rows,
      cols: Math.ceil(slots.length / Math.max(1, rows)),
      pitchX,
      pitchY,
      ownerId: mode === "extend" ? base.ownerId : owner,
      lessorId: ROLE_META[role].orgId && role === "lessor" ? ROLE_META[role].orgId! : "org-helio",
      contract: "lease",
      tariff: 0.16,
      leaseRate: LEASE,
      commissioned: new Date().toISOString().slice(0, 10),
      loadKw: units * 0.18,
      storageKwh: units * 5,
      timezone: "America/Los_Angeles",
      perimeter,
      slots,
    };
    // siteLngLat is derived from center + origin
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, mode, baseSite, name, owner, role, pitchX, pitchY, units, chosen, plan, center, origin, perimeter]);

  const estimate = useMemo(() => simulateDay(draftSite, new Date(), Math.max(1, units)), [draftSite, units]);

  // map layers
  const mapperSlots: MapperSlot[] = useMemo(() => {
    if (!plan) return [];
    const on = new Set(chosen);
    const openSet = new Set(plan.open);
    return plan.grid.map((g, i) => ({ p: toLngLat(origin, g.p), s: on.has(i) ? 1 : openSet.has(i) ? 0 : 2 }));
  }, [plan, chosen, origin]);
  const mapperInfra: MapperInfra[] = useMemo(() => {
    if (!plan?.infra) return [];
    const ll = (pts: XY[]) => pts.map((p) => toLngLat(origin, p));
    return [plan.infra.dropoff, plan.infra.swap].map((p: Placed) => ({
      kind: p.kind,
      label: INFRA[p.kind].label,
      center: toLngLat(origin, p.center),
      corners: ll(p.corners),
      truck: p.truck && ll(p.truck),
    }));
  }, [plan, origin]);

  const runs = useMemo(() => {
    if (!plan?.infra || !chosen.length) return null;
    const swap = plan.infra.swap.center;
    const d = chosen.map((i) => dist(plan.grid[i].p, swap));
    const far = chosen[d.indexOf(Math.max(...d))];
    const drop = plan.infra.dropoff;
    const firstSlot = chosen.reduce((a, b) => (dist(plan.grid[a].p, drop.center) < dist(plan.grid[b].p, drop.center) ? a : b));
    return {
      avg: d.reduce((a, b) => a + b, 0) / d.length,
      max: Math.max(...d),
      lines: [
        [drop.anchor, drop.center, plan.grid[firstSlot].p],
        [swap, plan.grid[far].p],
      ].map((l) => l.map((p) => toLngLat(origin, p as XY))),
    };
  }, [plan, chosen, origin]);

  const onMoveInfra = useCallback(
    (kind: InfraKind, p: LngLat) => setMoved((m) => ({ ...m, [kind]: toLocal(origin, p) })),
    [origin],
  );

  // 3 · registration
  const [paired, setPaired] = useState(0);
  const serials = useMemo(() => Array.from({ length: units }, (_, i) => `SS-${30100 + i}`), [units]);
  useEffect(() => setPaired(0), [units]);
  useEffect(() => {
    if (step !== 2 || paired === 0 || paired >= units) return;
    const id = setTimeout(() => setPaired((p) => Math.min(units, p + Math.ceil(units / 24))), 90);
    return () => clearTimeout(id);
  }, [paired, units, step]);

  // 5 · deploy
  const progress = useRef(0);
  const [deployPct, setDeployPct] = useState(0);
  const [commissioned, setCommissioned] = useState<Site | null>(null);
  useEffect(() => {
    if (step !== 4 || commissioned) return;
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
    const site = { ...draftSite, perimeter: [...perimeter] };
    addRobots(commissionSite(site));
    setSite("all");
    setCommissioned(site);
  };

  const canNext =
    step === 0
      ? mode === "extend" || !!picked
      : step === 1
        ? units > 0
        : step === 2
          ? paired >= units
          : step === 3
            ? capacity >= units && units > 0
            : true;

  return (
    <>
      <PageHeader title="Onboard robots" subtitle="Pick a site, map the perimeter, register units, place the drop-off and swap station, then deploy." />
      <Card className="p-4 sm:p-5 mb-4">
        <Stepper steps={STEPS} current={step} />
      </Card>

      {step === 0 && (
        <div className="grid gap-4 grid-cols-1 xl:grid-cols-[1fr_1.6fr]">
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
                <Select
                  label="Customer (site owner)"
                  size="lg"
                  icon={<Building2 />}
                  value={owner}
                  onChange={setOwner}
                  options={ORGS.filter((o) => o.kind === "buyer").map((o) => ({ value: o.id, label: o.name }))}
                />
                <div className="rounded-[var(--radius-md)] bg-surface-2 p-3 flex gap-3">
                  <MapPin className="size-4 text-accent mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">Click the map to drop a pin on the lot</div>
                    <div className="text-xs text-muted font-mono mt-0.5">
                      {picked ? `${picked[1].toFixed(5)}, ${picked[0].toFixed(5)}` : "No location yet"}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 text-sm">
                <Select
                  label="Site"
                  size="lg"
                  icon={<MapPin />}
                  value={baseSite}
                  onChange={setBaseSite}
                  options={SITES.map((s) => ({ value: s.id, label: s.name, description: s.region }))}
                />
                <span className="block text-xs text-muted mt-2">You&apos;ll map the new block next to the existing array.</span>
              </div>
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
              picked={mode === "new" ? picked : origin}
            />
          </Card>
        </div>
      )}

      {(step === 1 || step === 3) && (
        <div className="grid gap-4 grid-cols-1 xl:grid-cols-[1fr_1.6fr]">
          {step === 1 ? (
            <Panel title="Map & size the array" subtitle="Trace the fence line. The grid fills in and shows how many units the lot can hold.">
              {!plan ? (
                <div className="rounded-[var(--radius-md)] bg-surface-2 p-4 text-sm space-y-2">
                  <div className="font-medium flex items-center gap-2">
                    <PenLine className="size-4 text-primary" /> Draw the perimeter
                  </div>
                  <ol className="text-muted list-decimal pl-5 space-y-1">
                    <li>Click the map to place fence posts at each corner.</li>
                    <li>Click the first post (or “Close shape”) to finish.</li>
                    <li>Drag any post to adjust.</li>
                  </ol>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => onPerimeter(sampleLot(origin), true)}>
                    <Sparkles className="size-4" /> Trace a sample lot
                  </Button>
                </div>
              ) : (
                <div className="space-y-5 text-sm">
                  <div className="grid grid-cols-3 gap-3">
                    <Est label="Lot area" value={`${fmt.int(plan.area)} m²`} />
                    <Est label="Grid slots" value={fmt.int(plan.grid.length)} />
                    <Est label="Usable" value={fmt.int(capacity)} tone="primary" />
                  </div>
                  <p className="text-xs text-muted -mt-2">
                    {SETBACK} m setback from the fence. {plan.grid.length - capacity} slots are held for the truck drop-off and
                    battery-swap container; you&apos;ll fine-tune those after registration.
                  </p>
                  <div>
                    <span className="block text-muted mb-1.5">Row direction</span>
                    <Segmented
                      size="sm"
                      value={align}
                      onChange={(v) => {
                        setAlign(v);
                        setMoved({});
                      }}
                      options={[
                        { value: "edge", label: "Follow longest fence" },
                        { value: "ns", label: "East–west" },
                      ]}
                    />
                  </div>
                  <Slider label="Spacing across (m)" value={pitchX} min={2} max={3.5} step={0.1} onChange={setPitchX} fmt={(v) => `${v.toFixed(1)} m`} />
                  <Slider label="Row pitch (m)" value={pitchY} min={2.6} max={5} step={0.1} onChange={setPitchY} fmt={(v) => `${v.toFixed(1)} m`} />

                  <div className="border-t border-border pt-5 space-y-4">
                    <div className="flex items-end gap-3">
                      <label className="flex-1">
                        <span className="block text-muted mb-1.5">Monthly budget</span>
                        <span className="flex items-center h-10 rounded-[var(--radius-sm)] border border-border bg-surface px-3 gap-1 font-mono">
                          $
                          <input
                            type="number"
                            min={0}
                            step={100}
                            value={budget}
                            onChange={(e) => setBudget(Math.max(0, Number(e.target.value) || 0))}
                            className="w-full bg-transparent outline-none"
                          />
                        </span>
                      </label>
                      <Button variant="outline" onClick={() => setCount(Math.max(1, Math.min(capacity, affordable)))} disabled={!capacity}>
                        Fit budget
                      </Button>
                      <Button variant="outline" onClick={() => setCount(capacity)} disabled={!capacity}>
                        Fill site
                      </Button>
                    </div>
                    <Slider
                      label="Units to order"
                      value={units}
                      min={capacity ? 1 : 0}
                      max={capacity}
                      step={1}
                      onChange={setCount}
                      fmt={(v) => `${v} of ${capacity}`}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Est
                        label="Lease"
                        value={`${fmt.usd(units * LEASE)}/mo`}
                        warn={units * LEASE > budget ? `${fmt.usd(units * LEASE - budget)} over budget` : undefined}
                      />
                      <Est label="Array capacity" value={fmt.kw((units * 410) / 1000)} />
                      <Est label="Est. energy today" value={fmt.kwh(estimate.solarKwh)} />
                      <Est label="Est. energy value" value={`${fmt.usd(estimate.solarKwh * 30 * draftSite.tariff)}/mo`} />
                    </div>
                  </div>
                </div>
              )}
            </Panel>
          ) : (
            <Panel title="Drop-off & battery swap" subtitle="Suggested from road access and battery-run distance. Drag either one along the fence to adjust.">
              {plan?.infra && (
                <div className="space-y-4 text-sm">
                  <InfraCard
                    tone="primary"
                    title="Truck drop-off"
                    body={
                      moved.dropoff
                        ? "Placed manually."
                        : road
                          ? "Closest fence point to the nearest mapped road, so flatbeds back straight in."
                          : "No mapped road nearby, so it's on the longest open fence edge."
                    }
                    meta={`${INFRA.dropoff.along} × ${INFRA.dropoff.depth} m ramp landing · 16.5 m flatbed parks outside`}
                  />
                  <InfraCard
                    tone="copper"
                    title="Battery-swap container"
                    body={
                      moved.swap
                        ? "Placed manually."
                        : "The fence point with the shortest average battery run, kept clear of the truck apron."
                    }
                    meta="40 ft container · drive-through lane both sides"
                  />
                  {runs && (
                    <div className="grid grid-cols-3 gap-3">
                      <Est label="Avg battery run" value={`${runs.avg.toFixed(0)} m`} />
                      <Est label="Longest run" value={`${runs.max.toFixed(0)} m`} />
                      <Est label="Slots free" value={`${capacity}`} />
                    </div>
                  )}
                  {capacity < units ? (
                    <div className="rounded-[var(--radius-md)] border border-danger/40 bg-danger/10 p-3 flex gap-2 text-danger">
                      <TriangleAlert className="size-4 shrink-0 mt-0.5" />
                      <span>
                        This placement leaves {capacity} slots for {units} registered units. Move the drop-off or swap station, or go
                        back and tighten the spacing.
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted">
                      Units fill the slots nearest the swap container first. {capacity - units} spare slots stay open for expansion.
                    </p>
                  )}
                  {(moved.dropoff || moved.swap) && (
                    <Button variant="outline" size="sm" onClick={() => setMoved({})}>
                      <RotateCcw className="size-4" /> Reset to suggestion
                    </Button>
                  )}
                </div>
              )}
            </Panel>
          )}

          <Card className="overflow-hidden relative h-[560px]">
            <SiteMapper
              className="absolute inset-0"
              center={origin}
              perimeter={perimeter}
              closed={closed}
              drawing={step === 1 && !closed}
              onPerimeter={step === 1 ? onPerimeter : undefined}
              slots={mapperSlots}
              infra={mapperInfra}
              onMoveInfra={step === 3 ? onMoveInfra : undefined}
              routes={step === 3 ? runs?.lines : undefined}
              onRoad={setRoad}
            />
            {step === 1 && (
              <div className="absolute left-3 top-3 right-14 flex flex-wrap items-center gap-2 pointer-events-none">
                <div className="glass rounded-[var(--radius-sm)] px-3 py-2 text-xs pointer-events-auto">
                  {closed
                    ? "Drag fence posts to adjust"
                    : perimeter.length === 0
                      ? "Click to place the first fence post"
                      : perimeter.length < 3
                        ? `${perimeter.length} post${perimeter.length > 1 ? "s" : ""} · keep going`
                        : "Click the first post to close the perimeter"}
                </div>
                {!closed && perimeter.length > 0 && (
                  <Button size="sm" variant="outline" className="glass pointer-events-auto" onClick={() => setPerimeter((p) => p.slice(0, -1))}>
                    <Undo2 className="size-4" /> Undo
                  </Button>
                )}
                {!closed && perimeter.length >= 3 && (
                  <Button size="sm" className="pointer-events-auto" onClick={() => setClosed(true)}>
                    Close shape
                  </Button>
                )}
                {perimeter.length > 0 && (
                  <Button size="sm" variant="outline" className="glass pointer-events-auto" onClick={resetFence}>
                    <X className="size-4" /> {closed ? "Redraw" : "Clear"}
                  </Button>
                )}
              </div>
            )}
            {plan && (
              <div className="absolute left-3 bottom-9 glass rounded-[var(--radius-sm)] px-3 py-2 text-[0.6875rem] flex flex-wrap gap-x-3 gap-y-1 pointer-events-none">
                <Legend dot="bg-primary border-white" label={`${units} units`} />
                <Legend dot="bg-white/15 border-white/75" label={`${capacity - units} spare`} />
                <Legend dot="bg-danger/40 border-danger" label={`${plan.grid.length - capacity} reserved`} />
              </div>
            )}
          </Card>
        </div>
      )}

      {step === 2 && (
        <Panel
          title="Register & pair units"
          subtitle={`Scan the delivery manifest for ${units} units bound for ${draftSite.name}. Each unit authenticates and syncs firmware as it rolls through the portal.`}
        >
          <div className="flex flex-wrap items-end gap-4">
            <Button onClick={() => setPaired(1)} disabled={paired > 0}>
              <QrCode className="size-4" /> {paired === 0 ? "Scan manifest & pair" : paired < units ? "Pairing…" : "All paired"}
            </Button>
            <div className="text-sm text-muted">
              Order: {units} units · {fmt.usd(units * LEASE)}/mo lease
            </div>
            <div className="text-sm text-muted ml-auto font-mono">
              {paired}/{units} paired
            </div>
          </div>
          <div className="mt-5 grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-12 gap-1.5 max-h-[420px] overflow-y-auto">
            {serials.map((s, i) => (
              <div
                key={s}
                className={cn(
                  "rounded-[6px] px-1.5 py-1 text-[0.6562rem] font-mono text-center border transition-colors",
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

      {step === 4 && (
        <div className="grid gap-4 grid-cols-1 xl:grid-cols-[1.6fr_1fr]">
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
                  <PartyPopper className="size-5" /> {units} units are live at {commissioned.name}
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
                <Row k="Units" v={`${units} paired`} />
                <Row k="Site" v={draftSite.name} />
                <Row k="Lot" v={`${fmt.int(plan?.area ?? 0)} m² · ${capacity - units} spare slots`} />
                <Row k="Spacing" v={`${pitchX.toFixed(1)} × ${pitchY.toFixed(1)} m`} />
                <Row k="Battery runs" v={runs ? `avg ${runs.avg.toFixed(0)} m · max ${runs.max.toFixed(0)} m` : "—"} />
                <Row k="Capacity" v={fmt.kw((units * 410) / 1000)} />
                <Row k="Contract" v={<Badge tone="copper">Lease · ${LEASE}/unit/mo</Badge>} />
                <Button className="w-full mt-2" size="lg" disabled={deployPct < 1} onClick={commission}>
                  <CircleCheck className="size-4" /> {deployPct < 1 ? "Deploying…" : "Commission array"}
                </Button>
                <p className="text-xs text-muted">The preview shows the first 24 units of the formation.</p>
              </div>
            )}
          </Panel>
        </div>
      )}

      <div className="mt-4 flex justify-between">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || !!commissioned}>
          <ArrowLeft className="size-4" /> Back
        </Button>
        {step < 4 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
            {step === 1 && units ? `Order ${units} units` : "Continue"} <ArrowRight className="size-4" />
          </Button>
        ) : (
          commissioned && (
            <Button
              variant="outline"
              onClick={() => {
                setStep(0);
                setPaired(0);
                setCommissioned(null);
                resetFence();
                setCount(0);
              }}
            >
              <RotateCcw className="size-4" /> Onboard another site
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

function Est({ label, value, tone, warn }: { label: string; value: string; tone?: "primary"; warn?: string }) {
  return (
    <div className={cn("rounded-[var(--radius-md)] bg-surface-2 p-3", tone === "primary" && "bg-primary-soft")}>
      <div className="text-[0.6875rem] text-muted">{label}</div>
      <div className={cn("font-mono tabular font-semibold mt-0.5", tone === "primary" && "text-primary-soft-fg")}>{value}</div>
      {warn && <div className="text-[0.6875rem] text-danger mt-0.5">{warn}</div>}
    </div>
  );
}

function InfraCard({ tone, title, body, meta }: { tone: "primary" | "copper"; title: string; body: string; meta: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-surface-2 p-3 flex gap-3">
      <span className={cn("size-3 rounded-sm mt-1 shrink-0", tone === "primary" ? "bg-primary" : "bg-accent")} />
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-muted mt-0.5">{body}</div>
        <div className="text-xs text-subtle font-mono mt-1">{meta}</div>
      </div>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-full border", dot)} />
      {label}
    </span>
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
