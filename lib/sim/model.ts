/* SolarSwarm mock world: orgs, sites, robots, leases, tickets — deterministic from a seed. */

import type { RobotStatus } from "@/components/ui/badge";

export type Role = "buyer" | "lessor" | "ops";

export interface Org {
  id: string;
  name: string;
  kind: "buyer" | "lessor";
}

export interface Site {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  /** array heading in degrees (rows run east-west when 0) */
  heading: number;
  rows: number;
  cols: number;
  /** meters between units */
  pitchX: number;
  pitchY: number;
  ownerId: string; // buyer / renter
  lessorId: string; // fleet owner
  contract: "lease" | "ppa" | "purchase";
  /** $/kWh the site owner pays (PPA) or avoids (lease/purchase) */
  tariff: number;
  /** $ per robot per month (lease) */
  leaseRate: number;
  commissioned: string; // ISO date
  loadKw: number; // average daytime site load
  storageKwh: number;
  timezone: string;
  /** has a Blender ortho overlay in /public/renders */
  ortho?: boolean;
  /** onboarded sites: the fence line drawn in the site mapper ([lon, lat] ring) */
  perimeter?: [number, number][];
  /** onboarded sites: unit slots as metre offsets from lat/lon (replaces the rows × cols block) */
  slots?: { dx: number; dy: number; row: number; col: number }[];
}

export interface Health {
  motorTemp: number; // °C
  vibration: number; // mm/s RMS
  soiling: number; // 0..1 loss
  actuatorCurrent: number; // A
  batteryHealth: number; // 0..1 SoH
}

export interface Prediction {
  component: "Drive motor" | "Wheel bearing" | "Tilt actuator" | "Battery pack" | "Panel soiling" | "LiDAR";
  days: number;
  confidence: number;
}

export interface RobotUnit {
  id: string;
  serial: string;
  siteId: string;
  row: number;
  col: number;
  lat: number;
  lon: number;
  firmware: string;
  hours: number;
  ratedW: number;
  /** degradation rates drive health drift + predictions */
  wear: { motor: number; bearing: number; actuator: number; battery: number; dust: number };
  health: Health;
  risk: number; // 0..1
  prediction?: Prediction;
  forcedStatus?: RobotStatus;
}

export interface Ticket {
  id: string;
  siteId: string;
  robotId?: string;
  title: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "scheduled" | "resolved";
  opened: string;
  from: string;
}

export interface LeaseDeal {
  id: string;
  customer: string;
  units: number;
  stage: "Lead" | "Site survey" | "Proposal" | "Contract" | "Deploying";
  value: number;
  region: string;
}

/* --------------------------------- PRNG --------------------------------- */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------- World --------------------------------- */
export const ORGS: Org[] = [
  { id: "org-kessler", name: "Kessler Family Farms", kind: "buyer" },
  { id: "org-redmesa", name: "Red Mesa Water District", kind: "buyer" },
  { id: "org-piedmont", name: "Piedmont Cold Storage", kind: "buyer" },
  { id: "org-helio", name: "Helio Capital Partners", kind: "lessor" },
  { id: "org-sunfleet", name: "SunFleet Leasing", kind: "lessor" },
];

export const SITES: Site[] = [
  {
    id: "mojave",
    ortho: true,
    name: "Mojave Flats",
    region: "Kern County, CA",
    lat: 35.0525,
    lon: -118.1665,
    heading: 0,
    rows: 16,
    cols: 18,
    pitchX: 2.4,
    pitchY: 3.2,
    ownerId: "org-redmesa",
    lessorId: "org-helio",
    contract: "ppa",
    tariff: 0.118,
    leaseRate: 0,
    commissioned: "2025-11-04",
    loadKw: 62,
    storageKwh: 1440,
    timezone: "America/Los_Angeles",
  },
  {
    id: "valley",
    ortho: true,
    name: "Kessler Orchard Block C",
    region: "Fresno County, CA",
    lat: 36.5021,
    lon: -119.7582,
    heading: 0,
    rows: 10,
    cols: 16,
    pitchX: 2.3,
    pitchY: 3.0,
    ownerId: "org-kessler",
    lessorId: "org-helio",
    contract: "lease",
    tariff: 0.21,
    leaseRate: 38,
    commissioned: "2026-03-18",
    loadKw: 48,
    storageKwh: 800,
    timezone: "America/Los_Angeles",
  },
  {
    id: "permian",
    ortho: true,
    name: "Permian Pump Station 7",
    region: "Midland County, TX",
    lat: 31.9112,
    lon: -102.1655,
    heading: 0,
    rows: 12,
    cols: 20,
    pitchX: 2.4,
    pitchY: 3.2,
    ownerId: "org-redmesa",
    lessorId: "org-sunfleet",
    contract: "lease",
    tariff: 0.094,
    leaseRate: 34,
    commissioned: "2026-01-09",
    loadKw: 71,
    storageKwh: 1200,
    timezone: "America/Chicago",
  },
  {
    id: "piedmont",
    ortho: true,
    name: "Piedmont Cold Storage",
    region: "Chatham County, NC",
    lat: 35.6592,
    lon: -79.1765,
    heading: 0,
    rows: 8,
    cols: 12,
    pitchX: 2.3,
    pitchY: 3.4,
    ownerId: "org-piedmont",
    lessorId: "org-sunfleet",
    contract: "purchase",
    tariff: 0.132,
    leaseRate: 0,
    commissioned: "2026-06-22",
    loadKw: 38,
    storageKwh: 480,
    timezone: "America/New_York",
  },
];

export const ROLE_META: Record<Role, { label: string; short: string; orgId?: string; blurb: string }> = {
  buyer: {
    label: "Site owner · Buyer / Renter",
    short: "Buyer / Renter",
    orgId: "org-redmesa",
    blurb: "Your power, your savings, and your service status.",
  },
  lessor: {
    label: "Fleet owner · Seller / Lessor",
    short: "Seller / Lessor",
    orgId: "org-helio",
    blurb: "Utilization, revenue and lease pipeline across your fleet.",
  },
  ops: {
    label: "SolarSwarm Operations",
    short: "SolarSwarm Ops",
    blurb: "Every fleet, every unit: health, predictive maintenance and support.",
  },
};

export function sitesForRole(role: Role): Site[] {
  const org = ROLE_META[role].orgId;
  if (role === "buyer") return SITES.filter((s) => s.ownerId === org);
  if (role === "lessor") return SITES.filter((s) => s.lessorId === org);
  return SITES;
}

export const orgName = (id: string) => ORGS.find((o) => o.id === id)?.name ?? id;

/** meters → degrees at latitude */
function offset(lat: number, lon: number, dx: number, dy: number): [number, number] {
  const dLat = dy / 111_320;
  const dLon = dx / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [lat + dLat, lon + dLon];
}

export function siteBoundary(site: Site): [number, number][] {
  if (site.perimeter?.length) return [...site.perimeter, site.perimeter[0]];
  const w = site.cols * site.pitchX + 12;
  const h = site.rows * site.pitchY + 12;
  const c = [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
    [-w / 2, -h / 2],
  ];
  return c.map(([x, y]) => {
    const [la, lo] = offset(site.lat, site.lon, x, y);
    return [lo, la];
  });
}

const COMPONENTS: Prediction["component"][] = [
  "Drive motor",
  "Wheel bearing",
  "Tilt actuator",
  "Battery pack",
  "Panel soiling",
  "LiDAR",
];

function buildRobots(): RobotUnit[] {
  const rnd = mulberry32(20260927);
  const out: RobotUnit[] = [];
  let serial = 10231;
  for (const site of SITES) {
    for (let r = 0; r < site.rows; r++) {
      for (let c = 0; c < site.cols; c++) {
        const dx = (c - (site.cols - 1) / 2) * site.pitchX;
        const dy = ((site.rows - 1) / 2 - r) * site.pitchY;
        const [lat, lon] = offset(site.lat, site.lon, dx, dy);
        const hot = rnd() < 0.06; // a few units wear fast
        const wear = {
          motor: rnd() * (hot ? 0.9 : 0.25),
          bearing: rnd() * (hot ? 0.8 : 0.2),
          actuator: rnd() * (hot ? 0.7 : 0.2),
          battery: rnd() * 0.3,
          dust: 0.2 + rnd() * (site.id === "mojave" || site.id === "permian" ? 0.8 : 0.3),
        };
        const id = `SS-${serial++}`;
        out.push({
          id,
          serial: `${site.id.slice(0, 2).toUpperCase()}${(serial * 7919) % 100000}`.padEnd(7, "0"),
          siteId: site.id,
          row: r,
          col: c,
          lat,
          lon,
          firmware: rnd() < 0.85 ? "swarm-os 2.0.4" : "swarm-os 1.9.12",
          hours: Math.round(400 + rnd() * 3600),
          ratedW: 410,
          wear,
          health: { motorTemp: 38, vibration: 1.2, soiling: 0.02, actuatorCurrent: 1.1, batteryHealth: 0.97 },
          risk: 0,
        });
      }
    }
  }
  // a handful of hard faults and units out for service
  const faulty = [7, 133, 301, 455, 612];
  faulty.forEach((i) => out[i % out.length] && (out[i % out.length].forcedStatus = "fault"));
  [52, 219, 390].forEach((i) => out[i] && (out[i].forcedStatus = "docked"));
  [88, 89, 90, 91].forEach((i) => out[i] && (out[i].forcedStatus = "moving"));
  return out;
}

export const ROBOTS: RobotUnit[] = buildRobots();

/** Onboarding: register a new array block and its units into the live world (prototype, in-memory). */
export function commissionSite(site: Site): RobotUnit[] {
  const rnd = mulberry32(Date.now() % 100000);
  const units: RobotUnit[] = [];
  let serial = 20000 + ROBOTS.length;
  const slots =
    site.slots ??
    Array.from({ length: site.rows * site.cols }, (_, i) => {
      const r = Math.floor(i / site.cols);
      const c = i % site.cols;
      return { dx: (c - (site.cols - 1) / 2) * site.pitchX, dy: ((site.rows - 1) / 2 - r) * site.pitchY, row: r, col: c };
    });
  for (const { dx, dy, row: r, col: c } of slots) {
    const [lat, lon] = offset(site.lat, site.lon, dx, dy);
    units.push({
      id: `SS-${serial++}`,
      serial: `NW${serial}`,
      siteId: site.id,
      row: r,
      col: c,
      lat,
      lon,
      firmware: "swarm-os 2.0.4",
      hours: 0,
      ratedW: 410,
      wear: { motor: rnd() * 0.1, bearing: rnd() * 0.1, actuator: rnd() * 0.1, battery: 0, dust: 0.2 + rnd() * 0.3 },
      health: { motorTemp: 30, vibration: 0.9, soiling: 0, actuatorCurrent: 0.95, batteryHealth: 1 },
      risk: 0,
    });
  }
  SITES.push(site);
  ROBOTS.push(...units);
  return units;
}

export function offsetLatLon(lat: number, lon: number, dx: number, dy: number) {
  return offset(lat, lon, dx, dy);
}

/** Deterministic health drift + risk model evaluated at a point in time. */
export function evaluateHealth(u: RobotUnit, t: Date, irr: number, ambient: number) {
  const days = (t.getTime() - Date.UTC(2026, 0, 1)) / 86_400_000;
  const w = u.wear;
  const dayPhase = (t.getUTCHours() + t.getUTCMinutes() / 60) / 24;
  const soilCycle = ((days * w.dust * 0.9) % 14) / 14; // cleaned roughly every two weeks
  const h: Health = {
    motorTemp: ambient + 4 + irr * 0.006 + w.motor * 22 + Math.sin(dayPhase * 40 + u.col) * 0.8,
    vibration: 0.9 + w.bearing * 5.2 + Math.max(0, Math.sin(days / 9 + u.row)) * w.bearing * 1.8,
    soiling: Math.min(0.22, 0.01 + soilCycle * 0.14 * (0.4 + w.dust)),
    actuatorCurrent: 0.9 + w.actuator * 2.3,
    batteryHealth: Math.max(0.72, 0.99 - w.battery * 0.12 - days * 0.00008),
  };
  const f = [
    { c: "Drive motor" as const, v: (h.motorTemp - ambient - 10) / 22 },
    { c: "Wheel bearing" as const, v: (h.vibration - 1) / 5.5 },
    { c: "Tilt actuator" as const, v: (h.actuatorCurrent - 1) / 2.4 },
    { c: "Battery pack" as const, v: (0.97 - h.batteryHealth) / 0.2 },
    { c: "Panel soiling" as const, v: h.soiling / 0.3 },
  ].sort((a, b) => b.v - a.v);
  const top = f[0];
  const risk = 1 / (1 + Math.exp(-9 * (top.v - 0.7)));
  u.health = h;
  u.risk = u.forcedStatus === "fault" ? 0.97 : risk;
  u.prediction =
    u.risk > 0.35
      ? {
          component: u.forcedStatus === "fault" ? COMPONENTS[(u.row + u.col) % 3] : top.c,
          days: u.forcedStatus === "fault" ? 0 : Math.max(2, Math.round(60 * (1 - u.risk))),
          confidence: Math.min(0.97, 0.55 + u.risk * 0.42),
        }
      : undefined;
  return h;
}

export const TICKETS: Ticket[] = [
  { id: "T-4821", siteId: "mojave", robotId: "SS-10238", title: "Unit stopped mid-row after dust event", priority: "urgent", status: "in_progress", opened: "2026-09-27T14:12:00Z", from: "Auto-detected" },
  { id: "T-4817", siteId: "permian", title: "Request: add 40 units ahead of summer peak", priority: "medium", status: "open", opened: "2026-09-26T19:40:00Z", from: "Red Mesa Water District" },
  { id: "T-4815", siteId: "valley", robotId: "SS-10589", title: "Tilt actuator current trending high", priority: "high", status: "scheduled", opened: "2026-09-26T10:05:00Z", from: "Predictive" },
  { id: "T-4809", siteId: "piedmont", title: "Monthly production report discrepancy", priority: "low", status: "open", opened: "2026-09-25T15:22:00Z", from: "Piedmont Cold Storage" },
  { id: "T-4802", siteId: "mojave", title: "Schedule panel wash — soiling loss 9.8%", priority: "medium", status: "scheduled", opened: "2026-09-24T08:30:00Z", from: "Predictive" },
  { id: "T-4797", siteId: "permian", robotId: "SS-10766", title: "Wheel bearing vibration above threshold", priority: "high", status: "open", opened: "2026-09-23T22:18:00Z", from: "Predictive" },
  { id: "T-4790", siteId: "valley", title: "Relocate row 3 for orchard harvest access", priority: "medium", status: "resolved", opened: "2026-09-20T13:00:00Z", from: "Kessler Family Farms" },
];

export const PIPELINE: LeaseDeal[] = [
  { id: "D-311", customer: "Tulare Dairy Co-op", units: 180, stage: "Proposal", value: 82_080, region: "CA" },
  { id: "D-309", customer: "Yuma Greenhouses", units: 96, stage: "Site survey", value: 43_776, region: "AZ" },
  { id: "D-305", customer: "Odessa Midstream", units: 320, stage: "Contract", value: 145_920, region: "TX" },
  { id: "D-302", customer: "Salinas Cold Chain", units: 64, stage: "Deploying", value: 29_184, region: "CA" },
  { id: "D-298", customer: "Big Spring ISD", units: 120, stage: "Lead", value: 54_720, region: "TX" },
];
