"use client";

import { useMemo, useState } from "react";
import { Flame, Layers, TriangleAlert } from "lucide-react";
import { FleetMapLazy } from "@/components/map/FleetMapLazy";
import { RobotSummary, TwinCanvas } from "@/components/app/RobotTwin";
import { Segmented, Sheet, Toggle, statusMeta, type RobotStatus } from "@/components/ui";
import { fmt } from "@/lib/sim/energy";
import { useSim } from "@/lib/sim/store";
import { useFleet } from "@/lib/sim/useFleet";
import { cn } from "@/lib/cn";
import type { Basemap } from "@/components/map/FleetMap";

export default function MapPage() {
  const fleet = useFleet();
  const siteId = useSim((s) => s.siteId);
  const setSite = useSim((s) => s.setSite);
  const [basemap, setBasemap] = useState<Basemap>("satellite");
  const [heat, setHeat] = useState(false);
  const [selected, setSelected] = useState<string>();
  const robot = useMemo(() => fleet.robots.find((r) => r.unit.id === selected), [fleet.robots, selected]);
  const [focus, setFocus] = useState<string | undefined>(siteId === "all" ? undefined : siteId);

  return (
    <div className="-mx-3 sm:-mx-6 -my-6 relative h-[calc(100dvh-3.5rem)]">
      <FleetMapLazy
        className="absolute inset-0"
        sites={fleet.sites.map((s) => s.site)}
        robots={fleet.robots}
        summary={fleet.summary}
        basemap={basemap}
        heat={heat}
        focusSiteId={focus}
        selectedRobotId={selected}
        onSelectRobot={setSelected}
        onSelectSite={(id) => setFocus(id)}
      />

      {/* site list */}
      <div className="absolute top-3 left-3 w-[min(320px,calc(100%-24px))] glass rounded-[var(--radius-lg)] shadow-lg overflow-hidden">
        <div className="px-4 pt-3.5 pb-2 flex items-center justify-between">
          <div className="text-sm font-semibold">Sites</div>
          <button className="text-xs text-primary cursor-pointer" onClick={() => { setFocus(undefined); setSite("all"); }}>
            Show all
          </button>
        </div>
        <div className="max-h-[38vh] overflow-y-auto px-2 pb-2">
          {fleet.sites.map((s) => {
            const faults = s.robots.filter((r) => r.status === "fault").length;
            return (
              <button
                key={s.site.id}
                onClick={() => setFocus(s.site.id)}
                className={cn(
                  "w-full text-left rounded-[var(--radius-sm)] px-2.5 py-2 flex items-center gap-3 transition cursor-pointer",
                  focus === s.site.id ? "bg-primary-soft" : "hover:bg-surface-2/70",
                )}
              >
                <span className={cn("size-2 rounded-full shrink-0", s.sunUp ? "bg-accent" : "bg-border-strong")} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium truncate">{s.site.name}</span>
                  <span className="block text-xs text-muted truncate">
                    {s.robots.length} units · {s.sunUp ? fmt.kw(s.kw) : "night · stowed"}
                  </span>
                </span>
                {faults > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-danger font-mono">
                    <TriangleAlert className="size-3" aria-hidden />
                    {faults}
                    <span className="sr-only"> faulted</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* layer controls */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
        <div className="glass rounded-[var(--radius-md)] p-1 shadow-md">
          <Segmented
            size="sm"
            value={basemap}
            onChange={setBasemap}
            options={[
              { value: "satellite", label: "Satellite" },
              { value: "map", label: "Map" },
            ]}
          />
        </div>
        <div className="glass rounded-[var(--radius-md)] px-3 py-2 shadow-md">
          <Toggle
            checked={heat}
            onChange={setHeat}
            label={
              <span className="flex items-center gap-1.5 text-xs">
                <Flame className="size-3.5 text-accent" /> Generation heatmap
              </span>
            }
          />
        </div>
      </div>

      {/* legend */}
      <div className="absolute bottom-8 left-3 glass rounded-[var(--radius-md)] px-3 py-2.5 shadow-md">
        <div className="flex items-center gap-1.5 text-[0.6875rem] text-muted mb-1.5">
          <Layers className="size-3.5" /> Unit status (zoom in)
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {(Object.keys(statusMeta) as RobotStatus[]).map((s) => {
            const M = statusMeta[s];
            return (
              <span key={s} className="inline-flex items-center gap-1.5 text-xs">
                <span className="size-2.5 rounded-full border border-white/70" style={{ background: M.color }} />
                {M.label} <span className="font-mono text-muted">{fleet.totals.byStatus[s]}</span>
              </span>
            );
          })}
        </div>
      </div>

      <Sheet open={!!robot} onClose={() => setSelected(undefined)} title={robot ? `Unit ${robot.unit.id}` : ""}>
        {robot && (
          <>
            <TwinCanvas r={robot} className="h-64 bg-[#0e0c14]" />
            <div className="p-5">
              <RobotSummary r={robot} />
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}
