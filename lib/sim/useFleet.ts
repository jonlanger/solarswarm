"use client";

import { useMemo } from "react";
import { irradiance, pointAt, type DayPoint, type DaySummary } from "./energy";
import type { Site } from "./model";
import { liveRobots, siteDay, useScopedSites, useSim, type RobotLive } from "./store";

export interface SiteLive {
  site: Site;
  day: DaySummary;
  now: DayPoint;
  robots: RobotLive[];
  sunUp: boolean;
  kw: number;
}

export interface FleetLive {
  sites: SiteLive[];
  robots: RobotLive[];
  totals: {
    units: number;
    kw: number;
    kwhToday: number;
    loadKwhToday: number;
    exportKwhToday: number;
    importKwhToday: number;
    availability: number;
    faults: number;
    predicted: number;
    soc: number;
    byStatus: Record<RobotLive["status"], number>;
  };
  summary: Record<string, { kw: number; units: number }>;
}

/** Live, role-scoped fleet snapshot, recomputed on every sim tick. */
export function useFleet(): FleetLive {
  const sites = useScopedSites();
  const now = useSim((s) => s.now);
  const tick = useSim((s) => s.tick);
  return useMemo(() => {
    const live: SiteLive[] = sites.map((site) => {
      const robots = liveRobots(site, now);
      const day = siteDay(site, now);
      const p = pointAt(day, now);
      const kw = robots.reduce((a, r) => a + r.powerW, 0) / 1000;
      return { site, day, now: p, robots, sunUp: irradiance(site, new Date(now)).altitude > 0, kw };
    });
    const robots = live.flatMap((s) => s.robots);
    const byStatus = { tracking: 0, charging: 0, moving: 0, docked: 0, fault: 0 } as FleetLive["totals"]["byStatus"];
    robots.forEach((r) => byStatus[r.status]++);
    const units = robots.length || 1;
    const summary: FleetLive["summary"] = {};
    live.forEach((s) => (summary[s.site.id] = { kw: s.kw, units: s.robots.length }));
    // day totals up to "now"
    const upToNow = (d: DaySummary, key: "solarKw" | "loadKw") =>
      d.points.filter((p) => p.t <= now).reduce((a, p) => a + p[key] * (10 / 60), 0);
    return {
      sites: live,
      robots,
      summary,
      totals: {
        units: robots.length,
        kw: live.reduce((a, s) => a + s.kw, 0),
        kwhToday: live.reduce((a, s) => a + upToNow(s.day, "solarKw"), 0),
        loadKwhToday: live.reduce((a, s) => a + upToNow(s.day, "loadKw"), 0),
        exportKwhToday: live.reduce(
          (a, s) => a + s.day.points.filter((p) => p.t <= now && p.gridKw > 0).reduce((x, p) => x + p.gridKw / 6, 0),
          0,
        ),
        importKwhToday: live.reduce(
          (a, s) => a + s.day.points.filter((p) => p.t <= now && p.gridKw < 0).reduce((x, p) => x - p.gridKw / 6, 0),
          0,
        ),
        availability: 1 - (byStatus.fault + byStatus.docked * 0.5) / units,
        faults: byStatus.fault,
        predicted: robots.filter((r) => r.unit.prediction && r.unit.prediction.days > 0).length,
        soc: robots.reduce((a, r) => a + r.soc, 0) / units,
        byStatus,
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites, now, tick]);
}
