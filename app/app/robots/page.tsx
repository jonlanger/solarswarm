"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDownUp, Search } from "lucide-react";
import { PageHeader } from "@/components/app/AppShell";
import { RiskDial } from "@/components/app/widgets";
import { BatteryGauge, Card, Segmented, Select, StatusPill, statusMeta, type RobotStatus, type SelectOption } from "@/components/ui";
import { getSite } from "@/lib/sim/store";
import { useFleet } from "@/lib/sim/useFleet";

type Filter = "all" | RobotStatus | "risk";
type Sort = "risk" | "id" | "power" | "soc";

const SORTS: SelectOption<Sort>[] = [
  { value: "risk", label: "Risk (highest first)", textValue: "risk" },
  { value: "power", label: "Output (highest first)", textValue: "output" },
  { value: "soc", label: "Battery (lowest first)", textValue: "battery" },
  { value: "id", label: "Unit ID", textValue: "unit ID" },
];

export default function RobotsPage() {
  const fleet = useFleet();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("risk");
  const [page, setPage] = useState(0);
  const PER = 25;

  const rows = useMemo(() => {
    let list = fleet.robots;
    if (filter === "risk") list = list.filter((r) => r.unit.prediction);
    else if (filter !== "all") list = list.filter((r) => r.status === filter);
    if (q) list = list.filter((r) => r.unit.id.toLowerCase().includes(q.toLowerCase()) || getSite(r.unit.siteId)?.name.toLowerCase().includes(q.toLowerCase()));
    const by: Record<Sort, (a: (typeof list)[0], b: (typeof list)[0]) => number> = {
      risk: (a, b) => b.unit.risk - a.unit.risk,
      id: (a, b) => a.unit.id.localeCompare(b.unit.id),
      power: (a, b) => b.powerW - a.powerW,
      soc: (a, b) => a.soc - b.soc,
    };
    return [...list].sort(by[sort]);
  }, [fleet.robots, filter, q, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PER));
  const view = rows.slice(page * PER, page * PER + PER);

  return (
    <>
      <PageHeader title="Robots" subtitle={`${fleet.totals.units} units across ${fleet.sites.length} sites · live telemetry`} />
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Segmented<Filter>
          size="sm"
          label="Filter by status"
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(0);
          }}
          options={[
            { value: "all", label: `All ${fleet.totals.units}` },
            ...(["tracking", "moving", "charging", "docked", "fault"] as RobotStatus[]).map((s) => {
              const M = statusMeta[s];
              return {
                value: s,
                icon: <M.Icon style={{ color: M.color }} />,
                label: `${M.label} ${fleet.totals.byStatus[s]}`,
              };
            }),
            { value: "risk", label: `At risk ${fleet.robots.filter((r) => r.unit.prediction).length}` },
          ]}
        />
        <div className="relative flex-1 min-w-[10rem] sm:flex-none sm:ml-auto">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="search"
            aria-label="Search unit or site"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Search unit or site"
            className="h-9 w-full sm:w-56 pl-9 pr-3 rounded-[var(--radius-sm)] border border-border bg-surface text-sm outline-none focus:border-primary"
          />
        </div>
        <Select
          label="Sort by"
          hideLabel
          icon={<ArrowDownUp />}
          align="end"
          value={sort}
          onChange={setSort}
          renderValue={(o) => <>Sort: {o.textValue}</>}
          options={SORTS}
        />
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-xs text-muted text-left">
              <tr>
                <th className="font-medium px-4 h-10">Unit</th>
                <th className="font-medium px-4">Site</th>
                <th className="font-medium px-4">Status</th>
                <th className="font-medium px-4 text-right">Output</th>
                <th className="font-medium px-4">Battery</th>
                <th className="font-medium px-4">Health</th>
                <th className="font-medium px-4">Firmware</th>
              </tr>
            </thead>
            <tbody>
              {view.map((r) => (
                <tr key={r.unit.id} className="border-t border-border hover:bg-surface-2/60">
                  <td className="px-4 h-12">
                    <Link href={`/app/robots/${r.unit.id}`} className="font-mono font-medium text-primary hover:underline">
                      {r.unit.id}
                    </Link>
                  </td>
                  <td className="px-4 whitespace-nowrap">
                    {getSite(r.unit.siteId)?.name}
                    <span className="text-xs text-subtle ml-1.5">
                      R{r.unit.row + 1}·S{r.unit.col + 1}
                    </span>
                  </td>
                  <td className="px-4">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="px-4 text-right font-mono tabular">{Math.round(r.powerW)} W</td>
                  <td className="px-4 w-40">
                    <BatteryGauge value={r.soc * 100} />
                  </td>
                  <td className="px-4">
                    <div className="flex items-center gap-2">
                      <div className="scale-75 -ml-1">
                        <RiskDial value={r.unit.risk} />
                      </div>
                      <span className="text-xs text-muted whitespace-nowrap">
                        {r.unit.prediction ? r.unit.prediction.component : "Healthy"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 text-xs text-muted font-mono whitespace-nowrap">{r.unit.firmware}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 h-12 border-t border-border text-sm text-muted">
          <span>
            {rows.length ? page * PER + 1 : 0}–{Math.min(rows.length, page * PER + PER)} of {rows.length}
          </span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="px-3 h-8 rounded-[var(--radius-sm)] border border-border disabled:opacity-40 cursor-pointer">
              Previous
            </button>
            <button disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="px-3 h-8 rounded-[var(--radius-sm)] border border-border disabled:opacity-40 cursor-pointer">
              Next
            </button>
          </div>
        </div>
      </Card>
    </>
  );
}
