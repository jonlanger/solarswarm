"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Droplets, LifeBuoy, ShieldCheck, Timer } from "lucide-react";
import { PageHeader } from "@/components/app/AppShell";
import { Panel, RiskDial, TicketList } from "@/components/app/widgets";
import { Badge, Button, StatTile, StatusPill } from "@/components/ui";
import { fmt } from "@/lib/sim/energy";
import { TICKETS, type Prediction } from "@/lib/sim/model";
import { getSite, useSim } from "@/lib/sim/store";
import { useFleet } from "@/lib/sim/useFleet";
import { cn } from "@/lib/cn";

const ACTION: Record<Prediction["component"], string> = {
  "Drive motor": "Swap drive module at next stow",
  "Wheel bearing": "Ship bearing kit · 20 min swap",
  "Tilt actuator": "Recalibrate, then replace actuator",
  "Battery pack": "Schedule pack swap",
  "Panel soiling": "Add to wash route",
  LiDAR: "Clean face-mask glazing & recalibrate LiDAR",
};

export default function MaintenancePage() {
  const fleet = useFleet();
  const role = useSim((s) => s.role);
  const [orders, setOrders] = useState<Record<string, string>>({});
  const [tickets, setTickets] = useState<{ title: string; site: string }[]>([]);
  const [draft, setDraft] = useState({ title: "", site: fleet.sites[0]?.site.id ?? "" });

  const predictions = useMemo(
    () =>
      fleet.robots
        .filter((r) => r.unit.prediction)
        .sort((a, b) => (a.unit.prediction!.days - b.unit.prediction!.days) || b.unit.risk - a.unit.risk),
    [fleet.robots],
  );
  const soiling = fleet.sites.map((s) => ({
    site: s.site,
    avg: s.robots.reduce((a, r) => a + r.unit.health.soiling, 0) / Math.max(1, s.robots.length),
  }));
  const siteIds = fleet.sites.map((s) => s.site.id);
  const openTickets = TICKETS.filter((t) => siteIds.includes(t.siteId) && t.status !== "resolved").length + tickets.length;

  return (
    <>
      <PageHeader
        title={role === "buyer" ? "Service & support" : "Maintenance & support"}
        subtitle={
          role === "buyer"
            ? "SolarSwarm monitors every unit on your sites and fixes issues before they cost you energy."
            : "Predictive maintenance across the fleet: forecasts from motor, bearing, actuator, battery and soiling telemetry."
        }
      />
      <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <StatTile label="Predicted issues · 30 days" value={String(predictions.filter((p) => p.unit.prediction!.days > 0).length)} icon={<ClipboardList className="size-4" />} />
        <StatTile label="Active faults" value={String(fleet.totals.faults)} icon={<LifeBuoy className="size-4" />} delta={-25} deltaGoodWhen="down" />
        <StatTile label="Uptime (SLA 98.5%)" value={fmt.pct(fleet.totals.availability, 2)} icon={<ShieldCheck className="size-4" />} delta={0.4} />
        <StatTile label="Median time to resolve" value="6.4 h" icon={<Timer className="size-4" />} delta={-18} deltaGoodWhen="down" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Panel
          title={role === "buyer" ? "Upcoming service on your sites" : "Failure forecast"}
          subtitle={`${predictions.length} units flagged · sorted by time to failure`}
          bodyClass="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted text-left bg-surface-2">
                <tr>
                  <th className="font-medium px-5 h-9">Unit</th>
                  <th className="font-medium px-3">Component</th>
                  <th className="font-medium px-3">Window</th>
                  <th className="font-medium px-3">Recommended action</th>
                  <th className="font-medium px-5 text-right">Work order</th>
                </tr>
              </thead>
              <tbody>
                {predictions.slice(0, 12).map((r) => {
                  const p = r.unit.prediction!;
                  const wo = orders[r.unit.id];
                  return (
                    <tr key={r.unit.id} className="border-t border-border">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="scale-[0.8] -ml-1">
                            <RiskDial value={r.unit.risk} />
                          </div>
                          <div>
                            <Link href={`/app/robots/${r.unit.id}`} className="font-mono font-medium text-primary hover:underline">
                              {r.unit.id}
                            </Link>
                            <div className="text-xs text-muted">{getSite(r.unit.siteId)?.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3">
                        <div>{p.component}</div>
                        <div className="text-xs text-subtle">{fmt.pct(p.confidence, 0)} confidence</div>
                      </td>
                      <td className="px-3 whitespace-nowrap">
                        {p.days === 0 ? <StatusPill status="fault" /> : <Badge tone={p.days < 10 ? "warning" : "neutral"}>~{p.days} days</Badge>}
                      </td>
                      <td className="px-3 text-muted">{p.days === 0 ? "Dispatch spare, send unit to service lane" : ACTION[p.component]}</td>
                      <td className="px-5 text-right whitespace-nowrap">
                        {wo ? (
                          <span className="inline-flex items-center gap-1 text-xs text-success">
                            <CheckCircle2 className="size-3.5" /> {wo}
                          </span>
                        ) : role === "buyer" ? (
                          <span className="text-xs text-muted">Handled by SolarSwarm</span>
                        ) : (
                          <Button size="sm" variant="secondary" onClick={() => setOrders((o) => ({ ...o, [r.unit.id]: `WO-${7000 + Object.keys(o).length}` }))}>
                            Create
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Panel soiling by site" subtitle="Average output lost to dust; washes trigger at 8%">
            <div className="space-y-3.5">
              {soiling.map(({ site, avg }) => (
                <div key={site.id}>
                  <div className="flex justify-between text-sm">
                    <span className="truncate">{site.name}</span>
                    <span className="font-mono tabular">{fmt.pct(avg)}</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", avg > 0.08 ? "bg-warning" : "bg-copper")}
                      style={{ width: `${Math.min(100, (avg / 0.15) * 100)}%` }}
                    />
                  </div>
                  {avg > 0.08 && (
                    <div className="mt-1 text-xs text-warning flex items-center gap-1">
                      <Droplets className="size-3.5" /> Wash scheduled for Thursday
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Support" subtitle={`${openTickets} open`}>
            {tickets.map((t, i) => (
              <div key={i} className="mb-3 rounded-[var(--radius-md)] border border-primary/40 bg-primary-soft px-3 py-2.5 text-sm">
                <div className="font-medium">{t.title}</div>
                <div className="text-xs text-muted">
                  T-{4830 + i} · {getSite(t.site)?.name} · just now · awaiting triage
                </div>
              </div>
            ))}
            <TicketList siteIds={siteIds} limit={4} />
            <form
              className="mt-5 pt-5 border-t border-border space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!draft.title.trim()) return;
                setTickets((t) => [{ ...draft }, ...t]);
                setDraft((d) => ({ ...d, title: "" }));
              }}
            >
              <label className="text-sm font-medium" htmlFor="ticket-title">
                Open a ticket
              </label>
              <input
                id="ticket-title"
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="Describe the issue"
                className="w-full h-9 px-3 rounded-[var(--radius-sm)] border border-border bg-surface text-sm outline-none focus:border-primary"
              />
              <div className="flex gap-2">
                <select
                  aria-label="Site"
                  value={draft.site}
                  onChange={(e) => setDraft((d) => ({ ...d, site: e.target.value }))}
                  className="flex-1 h-9 px-2 rounded-[var(--radius-sm)] border border-border bg-surface text-sm"
                >
                  {fleet.sites.map((s) => (
                    <option key={s.site.id} value={s.site.id}>
                      {s.site.name}
                    </option>
                  ))}
                </select>
                <Button size="md" type="submit">
                  Submit
                </Button>
              </div>
            </form>
          </Panel>
        </div>
      </div>
    </>
  );
}
