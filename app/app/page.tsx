"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Bot, CircleDollarSign, Gauge, Leaf, ShieldAlert, Sun, Zap } from "lucide-react";
import { PageHeader } from "@/components/app/AppShell";
import { EnergyTodayChart, Panel, RiskList, SiteTable, StatusBreakdown, TicketList } from "@/components/app/widgets";
import { FleetMapLazy } from "@/components/map/FleetMapLazy";
import { Badge, StatTile, buttonClass } from "@/components/ui";
import { fmt } from "@/lib/sim/energy";
import { PIPELINE, ROLE_META, orgName } from "@/lib/sim/model";
import { useSim } from "@/lib/sim/store";
import { useFleet } from "@/lib/sim/useFleet";

export default function OverviewPage() {
  const role = useSim((s) => s.role);
  const now = useSim((s) => s.now);
  const setSite = useSim((s) => s.setSite);
  const fleet = useFleet();
  const { totals } = fleet;
  const meta = ROLE_META[role];
  const [selected, setSelected] = useState<string>();

  const savings = fleet.sites.reduce(
    (a, s) => a + (totals.kwhToday ? (s.day.solarKwh / Math.max(1, fleet.sites.reduce((x, y) => x + y.day.solarKwh, 0))) * totals.kwhToday : 0) * (0.19 - (s.site.contract === "ppa" ? s.site.tariff : 0)),
    0,
  );
  const mrr = fleet.sites.reduce((a, s) => a + s.robots.length * (s.site.leaseRate || 31), 0);
  const spark = fleet.sites[0]?.day.points.filter((_, i) => i % 6 === 0).map((p) => p.solarKw) ?? [];

  const kpis =
    role === "buyer"
      ? [
          { label: "Solar output now", value: fmt.kw(totals.kw), icon: <Sun className="size-4" />, spark },
          { label: "Generated today", value: fmt.kwh(totals.kwhToday), icon: <Zap className="size-4" />, delta: 4.2 },
          { label: "Saved today", value: fmt.usd(savings), icon: <CircleDollarSign className="size-4" />, delta: 6.1 },
          {
            label: "Load met on-site",
            value: fmt.pct(totals.loadKwhToday ? 1 - totals.importKwhToday / totals.loadKwhToday : 0, 0),
            icon: <Leaf className="size-4" />,
          },
        ]
      : role === "lessor"
        ? [
            { label: "Units deployed", value: fmt.int(totals.units), icon: <Bot className="size-4" />, delta: 12.5 },
            { label: "Fleet availability", value: fmt.pct(totals.availability), icon: <Gauge className="size-4" />, delta: 0.3 },
            { label: "Lease MRR", value: fmt.usd(mrr), icon: <CircleDollarSign className="size-4" />, delta: 8.4 },
            { label: "Energy today", value: fmt.kwh(totals.kwhToday), icon: <Zap className="size-4" />, spark },
          ]
        : [
            { label: "Units managed", value: fmt.int(totals.units), icon: <Bot className="size-4" /> },
            { label: "Fleet availability", value: fmt.pct(totals.availability), icon: <Gauge className="size-4" />, delta: 0.2 },
            { label: "Active faults", value: String(totals.faults), icon: <ShieldAlert className="size-4" />, delta: -25, deltaGoodWhen: "down" as const },
            { label: "Predicted failures · 30d", value: String(totals.predicted), icon: <ShieldAlert className="size-4" /> },
          ];

  return (
    <>
      <PageHeader
        title={role === "buyer" ? "Your solar" : role === "lessor" ? "Fleet portfolio" : "Operations overview"}
        subtitle={
          <>
            {meta.orgId ? orgName(meta.orgId) : "All customers"} · {fleet.sites.length} site
            {fleet.sites.length === 1 ? "" : "s"} · {meta.blurb}
          </>
        }
        actions={
          role !== "buyer" ? (
            <Link href="/app/onboarding" className={buttonClass("primary", "sm")}>
              Onboard robots
            </Link>
          ) : (
            <Link href="/app/maintenance" className={buttonClass("outline", "sm")}>
              Request service
            </Link>
          )
        }
      />

      <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <StatTile key={k.label} {...k} />
        ))}
      </div>

      <div className="mt-4 grid gap-4 grid-cols-1 xl:grid-cols-[1.5fr_1fr]">
        <Panel
          title="Fleet map"
          subtitle="Sentinel-2 imagery · zoom in to see every unit"
          action={
            <Link href="/app/map" className="text-sm text-primary inline-flex items-center gap-1">
              Open map <ArrowRight className="size-3.5" />
            </Link>
          }
          bodyClass="p-0 pt-4"
        >
          <FleetMapLazy
            className="h-[360px] rounded-b-[var(--radius-lg)] overflow-hidden"
            sites={fleet.sites.map((s) => s.site)}
            robots={fleet.robots}
            summary={fleet.summary}
            selectedRobotId={selected}
            onSelectRobot={setSelected}
            onSelectSite={setSite}
          />
        </Panel>
        <Panel title="Fleet status" subtitle={`${totals.units} units · live`}>
          <StatusBreakdown byStatus={totals.byStatus} total={totals.units} />
          <div className="mt-6 pt-5 border-t border-border">
            <div className="text-sm font-medium mb-3">
              {role === "buyer" ? "Service alerts" : "Highest predicted risk"}
            </div>
            <RiskList robots={fleet.robots} limit={role === "buyer" ? 3 : 4} compact />
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 grid-cols-1 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Energy today · kW" subtitle="Generation vs. site load (all selected sites)">
          <EnergyTodayChart sites={fleet.sites} now={now} />
        </Panel>
        {role === "lessor" ? (
          <Panel title="Lease pipeline" subtitle={`${PIPELINE.length} deals · ${fmt.usd(PIPELINE.reduce((a, p) => a + p.value, 0))} ACV`}>
            <div className="divide-y divide-border">
              {PIPELINE.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.customer}</div>
                    <div className="text-xs text-muted">
                      {p.units} units · {p.region} · {fmt.usd(p.value)}/yr
                    </div>
                  </div>
                  <Badge tone={p.stage === "Deploying" ? "primary" : p.stage === "Contract" ? "copper" : "neutral"}>
                    {p.stage}
                  </Badge>
                </div>
              ))}
            </div>
          </Panel>
        ) : (
          <Panel
            title={role === "buyer" ? "Service & support" : "Support queue"}
            action={
              <Link href="/app/maintenance" className="text-sm text-primary inline-flex items-center gap-1">
                All tickets <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            <TicketList siteIds={fleet.sites.map((s) => s.site.id)} />
          </Panel>
        )}
      </div>

      <div className="mt-4">
        <Panel title={role === "buyer" ? "Your sites" : "Sites"}>
          <SiteTable sites={fleet.sites} role={role} />
        </Panel>
      </div>
    </>
  );
}
