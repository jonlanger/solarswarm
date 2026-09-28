"use client";

import { useMemo } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BatteryCharging, Factory, PlugZap, Sun, UtilityPole } from "lucide-react";
import { PageHeader } from "@/components/app/AppShell";
import { Panel } from "@/components/app/widgets";
import { ChartTooltip, Legend, axisProps, gridProps, hourLabel } from "@/components/charts/chart-theme";
import { StatTile } from "@/components/ui";
import { fmt, pointAt, simulateDay, STEP_MIN } from "@/lib/sim/energy";
import { unitsAt, useSim } from "@/lib/sim/store";
import { useFleet } from "@/lib/sim/useFleet";

const DAY = 86_400_000;

export default function EnergyPage() {
  const fleet = useFleet();
  const now = useSim((s) => s.now);
  const role = useSim((s) => s.role);
  const sites = fleet.sites;

  const series = useMemo(() => {
    if (!sites.length) return [];
    return sites[0].day.points.map((p, i) => {
      const acc = { hour: (i * STEP_MIN) / 60, solar: 0, load: 0, charge: 0, discharge: 0, exp: 0, imp: 0, soc: 0 };
      for (const s of sites) {
        const q = pointAt(s.day, p.t);
        acc.solar += q.solarKw;
        acc.load += q.loadKw;
        acc.charge += Math.max(0, q.batteryKw);
        acc.discharge += Math.min(0, q.batteryKw);
        acc.exp += Math.max(0, q.gridKw);
        acc.imp += Math.min(0, q.gridKw);
        acc.soc += (q.soc * s.site.storageKwh) / sites.reduce((a, x) => a + x.site.storageKwh, 0);
      }
      return { ...acc, soc: acc.soc * 100 };
    });
  }, [sites]);

  const totals = useMemo(() => {
    const t = { solar: 0, load: 0, exp: 0, imp: 0, charge: 0, discharge: 0, fixed: 0 };
    for (const s of sites) {
      t.solar += s.day.solarKwh;
      t.load += s.day.loadKwh;
      t.exp += s.day.exportKwh;
      t.imp += s.day.importKwh;
      t.fixed += s.day.fixedKwh;
      for (const p of s.day.points) {
        if (p.batteryKw > 0) t.charge += (p.batteryKw * STEP_MIN) / 60;
        else t.discharge -= (p.batteryKw * STEP_MIN) / 60;
      }
    }
    return t;
  }, [sites]);

  const history = useMemo(() => {
    const out: { day: string; tracking: number; fixed: number }[] = [];
    for (let d = 13; d >= 0; d--) {
      const date = new Date(now - d * DAY);
      let tr = 0,
        fx = 0;
      for (const s of sites) {
        const r = simulateDay(s.site, date, unitsAt(s.site.id).length, {
          clouds: ((date.getUTCDate() * 7 + s.site.lat) % 10) / 22,
        });
        tr += r.solarKwh;
        fx += r.fixedKwh;
      }
      out.push({ day: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }), tracking: tr, fixed: fx });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites, Math.floor(now / DAY)]);

  const nowHour = sites[0] ? (now - sites[0].day.points[0].t) / 3_600_000 : 0;
  const direct = Math.max(0, totals.solar - totals.charge - totals.exp);

  return (
    <>
      <PageHeader
        title="Energy in / out"
        subtitle="Solar input, storage and output across the selected sites · today, site-local time"
      />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <StatTile label="Solar in" value={fmt.kwh(totals.solar)} icon={<Sun className="size-4" />} sparkColor="var(--chart-1)" spark={series.filter((_, i) => i % 6 === 0).map((p) => p.solar)} />
        <StatTile label="Site load" value={fmt.kwh(totals.load)} icon={<Factory className="size-4" />} spark={series.filter((_, i) => i % 6 === 0).map((p) => p.load)} sparkColor="var(--chart-3)" />
        <StatTile label="Battery cycled" value={fmt.kwh(totals.discharge)} icon={<BatteryCharging className="size-4" />} spark={series.filter((_, i) => i % 6 === 0).map((p) => p.soc)} sparkColor="var(--chart-2)" />
        <StatTile label="Grid export" value={fmt.kwh(totals.exp)} icon={<UtilityPole className="size-4" />} />
        <StatTile label="Grid import" value={fmt.kwh(totals.imp)} icon={<PlugZap className="size-4" />} deltaGoodWhen="down" />
      </div>

      <div className="mt-4 grid gap-4 grid-cols-1 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Power flows today · kW" subtitle="Positive: generation, charging and export · negative: battery discharge and grid import">
          <Legend
            items={[
              { label: "Solar", color: "var(--chart-1)" },
              { label: "Load", color: "var(--chart-3)" },
              { label: "Battery", color: "var(--chart-2)" },
              { label: "Grid export", color: "var(--chart-4)" },
              { label: "Grid import", color: "var(--chart-5)" },
            ]}
          />
          <div className="h-80 mt-2 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={0} barCategoryGap={1}>
                <defs>
                  <linearGradient id="eSolar" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="var(--chart-1)" stopOpacity={0.3} />
                    <stop offset="1" stopColor="var(--chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="hour" type="number" domain={[0, 24]} ticks={[0, 6, 12, 18, 24]} tickFormatter={hourLabel} {...axisProps} />
                <YAxis {...axisProps} width={44} tickFormatter={(v) => `${v}`} />
                <Tooltip content={<ChartTooltip labelFormatter={hourLabel} unit=" kW" />} cursor={{ stroke: "var(--border-strong)" }} />
                <ReferenceLine y={0} stroke="var(--border-strong)" />
                <Area dataKey="solar" name="Solar" type="monotone" stroke="var(--chart-1)" strokeWidth={2} fill="url(#eSolar)" isAnimationActive={false} />
                <Bar dataKey="charge" name="Battery charge" stackId="b" fill="var(--chart-2)" isAnimationActive={false} />
                <Bar dataKey="discharge" name="Battery discharge" stackId="b" fill="var(--chart-2)" fillOpacity={0.55} isAnimationActive={false} />
                <Line dataKey="exp" name="Grid export" type="monotone" stroke="var(--chart-4)" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line dataKey="imp" name="Grid import" type="monotone" stroke="var(--chart-5)" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line dataKey="load" name="Load" type="monotone" stroke="var(--chart-3)" strokeWidth={2} dot={false} isAnimationActive={false} />
                <ReferenceLine x={nowHour} stroke="var(--accent)" strokeWidth={1.5} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Where today's solar went">
            <FlowBar
              total={totals.solar}
              parts={[
                { label: "Used on site", v: direct, color: "var(--chart-1)" },
                { label: "Into batteries", v: totals.charge, color: "var(--chart-2)" },
                { label: "Exported", v: totals.exp, color: "var(--chart-4)" },
              ]}
            />
            <div className="mt-6 text-sm font-medium mb-3">Where the site load came from</div>
            <FlowBar
              total={totals.load}
              parts={[
                { label: "Direct solar", v: direct, color: "var(--chart-1)" },
                { label: "Batteries", v: totals.discharge, color: "var(--chart-2)" },
                { label: "Grid", v: totals.imp, color: "var(--chart-5)" },
              ]}
            />
          </Panel>
          <Panel title="Battery state of charge" subtitle={`${fmt.kwh(sites.reduce((a, s) => a + s.site.storageKwh, 0))} distributed across units`}>
            <div className="h-36 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="hour" type="number" domain={[0, 24]} ticks={[0, 6, 12, 18, 24]} tickFormatter={hourLabel} {...axisProps} />
                  <YAxis {...axisProps} width={40} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={<ChartTooltip labelFormatter={hourLabel} unit="%" digits={0} />} />
                  <Area dataKey="soc" name="State of charge" type="monotone" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
                  <ReferenceLine x={nowHour} stroke="var(--accent)" strokeWidth={1.5} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 grid-cols-1 xl:grid-cols-[1.6fr_1fr]">
        <Panel
          title="Last 14 days · tracking vs. fixed tilt"
          subtitle={`Tracking added ${fmt.pct(history.reduce((a, h) => a + h.tracking, 0) / Math.max(1, history.reduce((a, h) => a + h.fixed, 0)) - 1, 0)} more energy than an equivalent fixed-tilt array`}
        >
          <Legend
            items={[
              { label: "SolarSwarm tracking", color: "var(--chart-1)" },
              { label: "Fixed-tilt estimate", color: "var(--text-subtle)" },
            ]}
          />
          <div className="h-64 mt-2 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={history} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="day" {...axisProps} interval={1} />
                <YAxis {...axisProps} width={56} tickFormatter={(v) => fmt.kwh(v)} />
                <Tooltip content={<ChartTooltip unit=" kWh" digits={0} />} cursor={{ fill: "var(--surface-2)" }} />
                <Bar dataKey="tracking" name="Tracking" fill="var(--chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="fixed" name="Fixed tilt" fill="var(--text-subtle)" fillOpacity={0.5} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title={role === "buyer" ? "Your bill · today" : "Settlement · today"}>
          <div className="divide-y divide-border text-sm">
            {sites.map((s) => {
              const used = s.day.solarKwh - s.day.exportKwh;
              const value = s.site.contract === "ppa" ? used * s.site.tariff : used * s.site.tariff;
              return (
                <div key={s.site.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex justify-between gap-3">
                    <span className="font-medium truncate">{s.site.name}</span>
                    <span className="font-mono tabular">{fmt.usd(value)}</span>
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {s.site.contract === "ppa"
                      ? `PPA · ${fmt.kwh(used)} × $${s.site.tariff.toFixed(3)}/kWh billed`
                      : `${s.site.contract === "lease" ? "Lease" : "Owned"} · ${fmt.kwh(used)} avoided at $${s.site.tariff.toFixed(3)}/kWh`}
                    {s.day.exportKwh > 1 && ` · ${fmt.kwh(s.day.exportKwh)} exported`}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </>
  );
}

function FlowBar({ total, parts }: { total: number; parts: { label: string; v: number; color: string }[] }) {
  const sum = parts.reduce((a, p) => a + p.v, 0) || 1;
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden gap-[2px] bg-surface-2">
        {parts.map((p) => (
          <div key={p.label} style={{ width: `${(p.v / sum) * 100}%`, background: p.color }} title={`${p.label}: ${fmt.kwh(p.v)}`} />
        ))}
      </div>
      <div className="mt-3 space-y-1.5">
        {parts.map((p) => (
          <div key={p.label} className="flex items-center gap-2 text-sm">
            <span className="size-2.5 rounded-full" style={{ background: p.color }} />
            <span className="text-muted">{p.label}</span>
            <span className="ml-auto font-mono tabular">{fmt.kwh(p.v)}</span>
            <span className="w-12 text-right font-mono tabular text-xs text-subtle">{fmt.pct(p.v / (total || 1), 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
