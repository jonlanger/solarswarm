"use client";

import { create } from "zustand";
import { useEffect, useMemo } from "react";
import type { RobotStatus } from "@/components/ui/badge";
import { irradiance, pointAt, simulateDay, type DaySummary } from "./energy";
import { evaluateHealth, ROBOTS, SITES, sitesForRole, type Role, type RobotUnit, type Site } from "./model";

export interface RobotLive {
  unit: RobotUnit;
  status: RobotStatus;
  soc: number;
  powerW: number;
  tilt: number; // rad
  azimuth: number; // rad
}

interface SimState {
  role: Role;
  siteId: string | "all";
  /** simulated clock (epoch ms) */
  now: number;
  speed: number; // sim seconds per real second
  tick: number;
  setRole: (r: Role) => void;
  setSite: (s: string | "all") => void;
  setSpeed: (s: number) => void;
  advance: (realMs: number) => void;
  /** robots added through onboarding */
  onboarded: RobotUnit[];
  addRobots: (units: RobotUnit[]) => void;
}

export const useSim = create<SimState>((set) => ({
  role: "ops",
  siteId: "all",
  now: Date.now(),
  speed: 60,
  tick: 0,
  setRole: (role) => set({ role, siteId: "all" }),
  setSite: (siteId) => set({ siteId }),
  setSpeed: (speed) => set({ speed }),
  advance: (realMs) => set((s) => ({ now: s.now + realMs * s.speed, tick: s.tick + 1 })),
  onboarded: [],
  addRobots: (units) => set((s) => ({ onboarded: [...s.onboarded, ...units] })),
}));

/** Drive the sim clock (mount once in the app shell). */
export function useSimClock(intervalMs = 1000, paused = false) {
  const advance = useSim((s) => s.advance);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => advance(intervalMs), intervalMs);
    return () => clearInterval(id);
  }, [advance, intervalMs, paused]);
}

/* ----------------------------- derived data ----------------------------- */

const dayCache = new Map<string, DaySummary>();
export function siteDay(site: Site, now: number, units = unitsAt(site.id).length): DaySummary {
  const d = new Date(now);
  const key = `${site.id}:${d.toISOString().slice(0, 10)}:${units}`;
  let v = dayCache.get(key);
  if (!v) {
    v = simulateDay(site, d, units, { clouds: site.id === "piedmont" ? 0.35 : 0.05 });
    dayCache.set(key, v);
  }
  return v;
}

export function unitsAt(siteId: string) {
  return ROBOTS.filter((r) => r.siteId === siteId);
}

function statusFor(u: RobotUnit, alt: number, i: number, minute: number): RobotStatus {
  if (u.forcedStatus) return u.forcedStatus;
  if (alt <= 0.02) return (i + minute) % 9 === 0 ? "charging" : "docked";
  if (u.risk > 0.9) return "fault";
  if ((i * 31 + Math.floor(minute / 20)) % 97 === 0) return "moving";
  return "tracking";
}

export function liveRobots(site: Site, now: number): RobotLive[] {
  const t = new Date(now);
  const irr = irradiance(site, t);
  const ambient = 18 + 14 * Math.max(0, Math.sin(irr.altitude));
  const minute = Math.floor(now / 60000);
  const day = siteDay(site, now);
  const p = pointAt(day, now);
  return unitsAt(site.id).map((u, i) => {
    evaluateHealth(u, t, irr.poaTracking, ambient);
    const status = statusFor(u, irr.altitude, i, minute);
    const producing = status === "tracking";
    const powerW = producing ? u.ratedW * (irr.poaTracking / 1000) * 0.92 * (1 - u.health.soiling) : 0;
    const soc = Math.min(1, Math.max(0.08, p.soc + Math.sin(i * 12.9898) * 0.06 - (status === "fault" ? 0.25 : 0)));
    return {
      unit: u,
      status,
      soc,
      powerW,
      tilt: producing ? irr.tilt : status === "moving" ? 0 : 0,
      azimuth: producing ? irr.panelAzimuth : 0,
    };
  });
}

export function useScopedSites() {
  const role = useSim((s) => s.role);
  const siteId = useSim((s) => s.siteId);
  const worldVersion = useSim((s) => s.onboarded.length); // new sites appear after commissioning
  return useMemo(() => {
    const sites = sitesForRole(role);
    return siteId === "all" ? sites : sites.filter((s) => s.id === siteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, siteId, worldVersion]);
}

export function getSite(id: string) {
  return SITES.find((s) => s.id === id);
}
