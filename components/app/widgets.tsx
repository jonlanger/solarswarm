"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight, MessageSquare, TriangleAlert } from "lucide-react";
import { ChartTooltip, Legend, axisProps, gridProps, hourLabel } from "@/components/charts/chart-theme";
import { Badge, BatteryGauge, Card, CardHeader, StatusPill, statusMeta, type RobotStatus } from "@/components/ui";
import { fmt, pointAt, STEP_MIN } from "@/lib/sim/energy";
import { TICKETS, orgName } from "@/lib/sim/model";
import type { RobotLive } from "@/lib/sim/store";
import type { FleetLive, SiteLive } from "@/lib/sim/useFleet";
import { cn } from "@/lib/cn";

/* ---------------- energy today (sum of scoped sites) ---------------- */
export function EnergyTodayChart({ sites, now, height = 260 }: { sites: SiteLive[]; now: number; height?: number }) {
  const data = useMemo(() => {
    if (!sites.length) return [];
    const base = sites[0].day.points;
    return base.map((p, i) => {
      // align sites by instant (they sit in different time zones); axis is the first site's local time
      let solar = 0,
        load = 0;
      for (const s of sites) {
        const q = pointAt(s.day, p.t);
        solar += q.solarKw;
        load += q.loadKw;
      }
      return { hour: (i * STEP_MIN) / 60, solar: p.t <= now ? solar : null, forecast: solar, load };
    });
  }, [sites, now]);
  const nowHour = sites[0] ? (now - sites[0].day.points[0].t) / 3_600_000 : 0;
  return (
    <div>
      <Legend
        items={[
          { label: "Solar generation", color: "var(--chart-1)" },
          { label: "Forecast", color: "var(--chart-1)", dashed: true },
          { label: "Site load", color: "var(--chart-3)" },
        ]}
      />
      <div style={{ height }} className="mt-2 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="solarFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="var(--chart-1)" stopOpacity={0.35} />
                <stop offset="1" stopColor="var(--chart-1)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="hour" type="number" domain={[0, 24]} ticks={[0, 6, 12, 18, 24]} tickFormatter={hourLabel} {...axisProps} />
            <YAxis {...axisProps} width={44} tickFormatter={(v) => `${v}`} />
            <Tooltip content={<ChartTooltip labelFormatter={hourLabel} unit=" kW" />} cursor={{ stroke: "var(--border-strong)" }} />
            <Line type="monotone" dataKey="forecast" name="Forecast" stroke="var(--chart-1)" strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
            <Area type="monotone" dataKey="solar" name="Solar" stroke="var(--chart-1)" strokeWidth={2} fill="url(#solarFill)" isAnimationActive={false} connectNulls={false} />
            <Line type="monotone" dataKey="load" name="Load" stroke="var(--chart-3)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <ReferenceLine x={nowHour} stroke="var(--accent)" strokeWidth={1.5} label={{ value: "now", position: "insideTopRight", fill: "var(--text-subtle)", fontSize: 11 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ---------------- status breakdown ---------------- */
export function StatusBreakdown({ byStatus, total }: { byStatus: FleetLive["totals"]["byStatus"]; total: number }) {
  const order: RobotStatus[] = ["tracking", "charging", "moving", "docked", "fault"];
  return (
    <div>
      <div
        role="img"
        aria-label={`Fleet status: ${order.map((s) => `${byStatus[s]} ${statusMeta[s].label.toLowerCase()}`).join(", ")}`}
        className="flex h-3 rounded-full overflow-hidden gap-[2px] bg-surface-2"
      >
        {order.map((s) =>
          byStatus[s] ? (
            <div
              key={s}
              title={`${statusMeta[s].label}: ${byStatus[s]}`}
              style={{ width: `${(byStatus[s] / Math.max(1, total)) * 100}%`, background: statusMeta[s].color }}
            />
          ) : null,
        )}
      </div>
      {/* sized by the card, not the viewport: the legend wraps before any label can collide with a count */}
      <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-5 gap-y-2.5" aria-hidden>
        {order.map((s) => {
          const M = statusMeta[s];
          return (
            <li key={s} className="flex min-w-0 items-center gap-2 text-sm">
              <M.Icon className="size-4 shrink-0" style={{ color: M.color }} />
              <span className="truncate text-muted">{M.label}</span>
              <span className="ml-auto font-mono tabular font-medium">{byStatus[s]}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------- risk list ---------------- */
export function RiskList({ robots, limit = 6, compact }: { robots: RobotLive[]; limit?: number; compact?: boolean }) {
  const list = useMemo(
    () =>
      robots
        .filter((r) => r.unit.prediction)
        .sort((a, b) => b.unit.risk - a.unit.risk)
        .slice(0, limit),
    [robots, limit],
  );
  if (!list.length) return <p className="text-sm text-muted">No predicted issues. Every unit is healthy.</p>;
  return (
    <div className="divide-y divide-border">
      {list.map((r) => {
        const p = r.unit.prediction!;
        return (
          <Link
            key={r.unit.id}
            href={`/app/robots/${r.unit.id}`}
            className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 group"
          >
            <RiskDial value={r.unit.risk} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="font-mono">{r.unit.id}</span>
                {!compact && <StatusPill status={r.status} />}
              </div>
              <div className="text-xs text-muted line-clamp-2 mt-0.5">
                {p.component} · {p.days === 0 ? "failed, dispatch needed" : `failure likely in ~${p.days} days`} ·{" "}
                {fmt.pct(p.confidence, 0)} conf.
              </div>
            </div>
            <ArrowUpRight className="size-4 text-subtle group-hover:text-text transition" />
          </Link>
        );
      })}
    </div>
  );
}

export function RiskDial({ value }: { value: number }) {
  const tone = value > 0.85 ? "var(--danger)" : value > 0.6 ? "var(--warning)" : "var(--primary)";
  const c = 2 * Math.PI * 15;
  return (
    <div className="relative size-10 shrink-0" title={`Risk score ${Math.round(value * 100)} of 100`}>
      <span className="sr-only">Risk score {Math.round(value * 100)} of 100</span>
      <svg viewBox="0 0 36 36" className="size-full -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--surface-2)" strokeWidth="4" />
        <circle cx="18" cy="18" r="15" fill="none" stroke={tone} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${value * c} ${c}`} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[0.625rem] font-mono font-semibold" aria-hidden>
        {Math.round(value * 100)}
      </span>
    </div>
  );
}

/* ---------------- tickets ---------------- */
const PRIORITY_TONE = { low: "neutral", medium: "info", high: "warning", urgent: "danger" } as const;
const STATUS_LABEL = { open: "Open", in_progress: "In progress", scheduled: "Scheduled", resolved: "Resolved" };

export function TicketList({ siteIds, limit = 5 }: { siteIds: string[]; limit?: number }) {
  const list = TICKETS.filter((t) => siteIds.includes(t.siteId)).slice(0, limit);
  if (!list.length) return <p className="text-sm text-muted">No open tickets.</p>;
  return (
    <div className="divide-y divide-border">
      {list.map((t) => (
        <div key={t.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
          <span className="size-8 rounded-[var(--radius-sm)] bg-surface-2 grid place-items-center shrink-0">
            <MessageSquare className="size-4 text-muted" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium line-clamp-2">{t.title}</div>
            <div className="text-xs text-muted mt-0.5 truncate">
              <span className="font-mono">{t.id}</span> · {t.from} ·{" "}
              {new Date(t.opened).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
            <span className="text-[0.6875rem] text-subtle">{STATUS_LABEL[t.status]}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- site table ---------------- */
export function SiteTable({ sites, role }: { sites: SiteLive[]; role: "buyer" | "lessor" | "ops" }) {
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted text-left">
            <th className="font-medium px-5 pb-2">Site</th>
            <th className="font-medium px-3 pb-2">{role === "buyer" ? "Contract" : "Customer"}</th>
            <th className="font-medium px-3 pb-2 text-right">Units</th>
            <th className="font-medium px-3 pb-2 text-right">Now</th>
            <th className="font-medium px-3 pb-2 text-right">Today</th>
            <th className="font-medium px-5 pb-2">Battery</th>
          </tr>
        </thead>
        <tbody>
          {sites.map((s) => {
            const faults = s.robots.filter((r) => r.status === "fault").length;
            return (
              <tr key={s.site.id} className="border-t border-border hover:bg-surface-2/60">
                <td className="px-5 py-3">
                  <div className="font-medium">{s.site.name}</div>
                  <div className="text-xs text-muted">{s.site.region}</div>
                </td>
                <td className="px-3 py-3 text-muted whitespace-nowrap">
                  {role === "buyer" ? s.site.contract.toUpperCase() : orgName(s.site.ownerId)}
                </td>
                <td className="px-3 py-3 text-right font-mono tabular whitespace-nowrap">
                  {s.robots.length}
                  {faults > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-danger text-xs ml-1.5 align-middle">
                    <TriangleAlert className="size-3" aria-hidden />
                    {faults}
                    <span className="sr-only"> faulted</span>
                  </span>
                )}
                </td>
                <td className="px-3 py-3 text-right font-mono tabular whitespace-nowrap">{fmt.kw(s.kw)}</td>
                <td className="px-3 py-3 text-right font-mono tabular whitespace-nowrap">{fmt.kwh(s.day.solarKwh)}</td>
                <td className="px-5 py-3 w-40">
                  <BatteryGauge value={s.now.soc * 100} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClass,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <Card className={cn("flex flex-col min-w-0", className)}>
      <CardHeader title={title} subtitle={subtitle} action={action} />
      <div className={cn("p-5 flex-1 min-h-0", bodyClass)}>{children}</div>
    </Card>
  );
}
