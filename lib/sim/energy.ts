/* Physics-lite energy model: real sun position (suncalc) → irradiance → per-site power flows. */

import { clearSkyDNI, incidence, sunPosition, sunVectorFromAngles, trackingPose } from "@/lib/sun";
import type { Site } from "./model";

export const STEP_MIN = 10;

/** Minutes the site's timezone is ahead of UTC at `date`. */
export function tzOffsetMinutes(date: Date, timeZone: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return Math.round((asUTC - date.getTime()) / 60000);
}

/** Start of the local day (as a UTC Date) at the site. */
export function localMidnight(date: Date, timeZone: string) {
  const off = tzOffsetMinutes(date, timeZone);
  const local = new Date(date.getTime() + off * 60000);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - off * 60000);
}

export function localTimeLabel(date: Date, timeZone: string) {
  return date.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
}

export interface Irradiance {
  altitude: number;
  azimuth: number;
  sun: [number, number, number];
  dni: number;
  dhi: number;
  /** plane-of-array W/m² for a dual-axis tracker */
  poaTracking: number;
  /** plane-of-array W/m² for fixed tilt = latitude, due south */
  poaFixed: number;
  tilt: number;
  panelAzimuth: number;
}

export function irradiance(site: Site, t: Date, clouds = 0): Irradiance {
  const { altitude, azimuth } = sunPosition(t, site.lat, site.lon);
  const sun = sunVectorFromAngles(azimuth, altitude);
  const dni = clearSkyDNI(altitude) * (1 - 0.75 * clouds);
  const dhi = altitude > 0 ? (80 + 60 * Math.sin(altitude)) * (1 + clouds * 0.6) : 0;
  const pose = trackingPose(sun, 0, 1.05);
  const trackInc = pose.stowed ? 0 : incidence(sun, pose.tilt, pose.azimuth);
  // fixed tilt = latitude facing south (+Z in scene space is south)
  const fixedInc = incidence(sun, (site.lat * Math.PI) / 180, 0);
  return {
    altitude,
    azimuth,
    sun,
    dni,
    dhi,
    poaTracking: dni * trackInc + dhi,
    poaFixed: dni * fixedInc + dhi * 0.9,
    tilt: pose.tilt,
    panelAzimuth: pose.azimuth,
  };
}

/** Relative daytime load shape (pumps / cooling). */
function loadShape(hour: number) {
  const base = 0.42;
  const day = Math.exp(-Math.pow((hour - 13) / 4.2, 2)) * 0.68;
  const eve = Math.exp(-Math.pow((hour - 19.5) / 1.6, 2)) * 0.35;
  return base + day + eve;
}

export interface DayPoint {
  t: number; // epoch ms
  hour: number; // local hour (fractional)
  solarKw: number;
  fixedKw: number;
  loadKw: number;
  batteryKw: number; // + charging, - discharging
  gridKw: number; // + export, - import
  soc: number; // 0..1
  poa: number;
}

export interface DaySummary {
  points: DayPoint[];
  solarKwh: number;
  fixedKwh: number;
  loadKwh: number;
  exportKwh: number;
  importKwh: number;
  selfSupplied: number; // share of load met by solar+battery
  trackingGain: number; // vs fixed tilt
  peakKw: number;
}

export function simulateDay(site: Site, day: Date, units: number, opts?: { derate?: number; clouds?: number }): DaySummary {
  const start = localMidnight(day, site.timezone).getTime();
  const ratedKw = (units * 410) / 1000;
  const derate = opts?.derate ?? 0.9;
  const cloudsBase = opts?.clouds ?? 0;
  const cap = site.storageKwh;
  let soc = 0.42;
  const dtH = STEP_MIN / 60;
  const points: DayPoint[] = [];
  let solarKwh = 0,
    fixedKwh = 0,
    loadKwh = 0,
    exportKwh = 0,
    importKwh = 0,
    peak = 0;
  for (let m = 0; m <= 24 * 60; m += STEP_MIN) {
    const t = start + m * 60000;
    const hour = m / 60;
    const clouds = cloudsBase * (0.5 + 0.5 * Math.sin(hour * 1.3 + site.lat));
    const irr = irradiance(site, new Date(t), Math.max(0, clouds));
    const solarKw = (ratedKw * irr.poaTracking * derate) / 1000;
    const fixedKw = (ratedKw * irr.poaFixed * derate) / 1000;
    const loadKw = site.loadKw * loadShape(hour);
    let net = solarKw - loadKw;
    let batteryKw = 0;
    const maxRate = cap * 0.5;
    if (net > 0) {
      const room = ((0.98 - soc) * cap) / dtH;
      batteryKw = Math.min(net, maxRate, Math.max(0, room));
      net -= batteryKw;
    } else {
      const avail = ((soc - 0.1) * cap) / dtH;
      batteryKw = -Math.min(-net, maxRate, Math.max(0, avail));
      net -= batteryKw;
    }
    soc = Math.min(0.98, Math.max(0.1, soc + (batteryKw * dtH) / cap));
    const gridKw = net; // + export, - import
    points.push({ t, hour, solarKw, fixedKw, loadKw, batteryKw, gridKw, soc, poa: irr.poaTracking });
    if (m < 24 * 60) {
      solarKwh += solarKw * dtH;
      fixedKwh += fixedKw * dtH;
      loadKwh += loadKw * dtH;
      if (gridKw > 0) exportKwh += gridKw * dtH;
      else importKwh += -gridKw * dtH;
    }
    peak = Math.max(peak, solarKw);
  }
  return {
    points,
    solarKwh,
    fixedKwh,
    loadKwh,
    exportKwh,
    importKwh,
    selfSupplied: loadKwh ? 1 - importKwh / loadKwh : 0,
    trackingGain: fixedKwh ? solarKwh / fixedKwh - 1 : 0,
    peakKw: peak,
  };
}

/** Interpolate a day series at an instant. */
export function pointAt(day: DaySummary, t: number): DayPoint {
  const p = day.points;
  if (t <= p[0].t) return p[0];
  if (t >= p[p.length - 1].t) return p[p.length - 1];
  const i = Math.floor((t - p[0].t) / (STEP_MIN * 60000));
  const a = p[i];
  const b = p[Math.min(p.length - 1, i + 1)];
  const k = (t - a.t) / (b.t - a.t || 1);
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return {
    t,
    hour: lerp(a.hour, b.hour),
    solarKw: lerp(a.solarKw, b.solarKw),
    fixedKw: lerp(a.fixedKw, b.fixedKw),
    loadKw: lerp(a.loadKw, b.loadKw),
    batteryKw: lerp(a.batteryKw, b.batteryKw),
    gridKw: lerp(a.gridKw, b.gridKw),
    soc: lerp(a.soc, b.soc),
    poa: lerp(a.poa, b.poa),
  };
}

export const fmt = {
  kw: (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(2)} MW` : `${v.toFixed(1)} kW`),
  kwh: (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(2)} MWh` : `${Math.round(v)} kWh`),
  usd: (v: number) =>
    v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: v < 100 ? 2 : 0 }),
  pct: (v: number, d = 1) => `${(v * 100).toFixed(d)}%`,
  int: (v: number) => Math.round(v).toLocaleString("en-US"),
};
