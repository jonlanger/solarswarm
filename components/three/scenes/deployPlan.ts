/**
 * Choreography for the "From truck to field" story — pure data, no React (so scripts/check-deploy.mjs can sweep
 * the whole timeline and prove that no two vehicles ever overlap).
 *
 * Layout (three.js: up = +Y). A convoy of flatbeds backs into the dock from +Z, six units per truck. Units roll down
 * the two bed-lane ramps, merge, pass the wash & inspect gate and fill a 4 × 6 formation (farthest slots first).
 * Later, units swap batteries at the station off the formation's west edge, on a one-way loop.
 *
 * Separation rules: units move at a constant speed with departures spaced UNIT_GAP apart along shared paths; the
 * next truck waits in a queue spot clear of the dock; the empty truck pulls out into a side lane.
 */
import * as THREE from "three";

const ss = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const ROWS = 4;
export const COLS = 6;
export const N = ROWS * COLS;
export const PER_TRUCK = 6;
export const TRUCKS = N / PER_TRUCK;
export const DOCK_Z = 12; // docked truck origin
export const QUEUE_Z = 36; // next truck waits here (its rear ≈ 31.4 m, clear of the docked truck's cab ≈ 17.7 m)
export const EXIT_X = 6; // empty trucks pull forward into this lane
export const BED_Y = 1.28;
export const BED_REAR = 4.5; // bed rear edge, truck-local (+z points out of the rear inside the truck group)
export const RAMP_LEN = 5; // 14.8°: inside the unit's ±15° slope rating
export const RAMP_ANG = Math.asin(BED_Y / RAMP_LEN);
export const LANE_X = 0.62; // bed lanes
export const GATE_Z = -1.5;
export const ROW0_Z = -7;
export const PITCH_X = 2.3;
export const PITCH_Z = 2.8;
export const SWAP_POS: [number, number, number] = [-13.5, 0, -11]; // swap station origin (lane along Z)
export const SWAP = { deck: 1.13, half: 3.03, ramp: 5, port: 1.35 };
export const OUT_LANE = -8.4; // to the station
export const RET_LANE = -10.9; // back from the station
export const PARKED_TRUCK: [number, number, number] = [-20, 0, -11]; // the flatbed that dropped the swap station
export const WHEEL_R = 0.17;

export const V_ROLL = 300; // m per unit progress (constant speed ⇒ constant spacing)
export const UNIT_GAP = 2.6; // m between consecutive units on shared paths (unit 1.4 m, stowed panel 1.65 m)
const DT = UNIT_GAP / V_ROLL;
export const V_SWAP = 500;

/** Scroll phases (progress 0..1). */
export const PHASES = {
  arrive: [0, 0.05],
  roll: [0.05, 0.57],
  raise: [0.57, 0.63],
  track: [0.63, 0.75],
  swap: [0.75, 1],
} as const;

export const yawOf = (t: THREE.Vector3) => Math.atan2(-t.x, -t.z);
export function lerpAngle(a: number, b: number, k: number) {
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
}

/* ------------------------------------------------------------------ trucks */
export interface TruckPlan {
  queueIn: [number, number]; // reversing from far away to the queue spot
  dockIn: [number, number]; // reversing from the queue spot (truck 0: from the road) to the dock
  unload: number; // first unit departs
  rampsUp: number; // last unit has cleared the ramps
  leave: [number, number]; // forward, out through the exit lane
}

export interface TruckState {
  x: number;
  z: number;
  yaw: number;
  visible: boolean;
}

const EXIT = new THREE.CatmullRomCurve3(
  [V3(0, 0, DOCK_Z), V3(0, 0, DOCK_Z + 4), V3(EXIT_X * 0.7, 0, DOCK_Z + 10), V3(EXIT_X, 0, DOCK_Z + 16), V3(EXIT_X, 0, 110)],
  false,
  "centripetal",
);

export function planTrucks(bedToFoot = 6.5 + RAMP_LEN): TruckPlan[] {
  const plans: TruckPlan[] = [];
  let t = PHASES.arrive[1];
  for (let k = 0; k < TRUCKS; k++) {
    const dockIn: [number, number] = k === 0 ? [PHASES.arrive[0], PHASES.arrive[1]] : [t, t + 0.02];
    const unload = dockIn[1] + 0.008; // ramps lowered
    const lastDepart = unload + (PER_TRUCK - 1) * DT;
    const rampsUp = lastDepart + bedToFoot / V_ROLL + 0.004;
    const leave: [number, number] = [rampsUp + 0.008, rampsUp + 0.038];
    plans.push({ queueIn: [dockIn[0] - 0.05, dockIn[0] - 0.012], dockIn, unload, rampsUp, leave });
    t = leave[0] + 0.012; // the next truck reverses in once the empty one has swung into the exit lane
  }
  return plans;
}

export function truckPose(pl: TruckPlan, first: boolean, p: number, out: TruckState) {
  out.yaw = Math.PI; // cab toward +z; reversing moves it toward -z
  out.x = 0;
  out.visible = true;
  if (p < pl.queueIn[0] && !first) {
    out.visible = false;
    out.z = 120;
  } else if (p < pl.dockIn[0]) {
    out.z = lerp(120, QUEUE_Z, ss(p, pl.queueIn[0], pl.queueIn[1]));
  } else if (p < pl.leave[0]) {
    out.z = lerp(first ? 58 : QUEUE_Z, DOCK_Z, ss(p, pl.dockIn[0], pl.dockIn[1]));
  } else {
    const u = ss(p, pl.leave[0], pl.leave[1]);
    const pt = EXIT.getPointAt(u);
    out.x = pt.x;
    out.z = pt.z;
    out.yaw = yawOf(EXIT.getTangentAt(Math.min(u, 0.999)));
    out.visible = u < 0.98;
  }
}

/** Ramp deployment 0 (stowed upright) … 1 (down). */
export const rampDown = (pl: TruckPlan, p: number) => ss(p, pl.dockIn[1], pl.unload) * (1 - ss(p, pl.rampsUp, pl.rampsUp + 0.008));

/* ------------------------------------------------------------------ unit routes */
export interface Route {
  path: THREE.CurvePath<THREE.Vector3>;
  len: number;
  depart: number;
  gateS: number; // arc length at the gate
  truck: number;
  bed: THREE.Vector3; // slot on the bed, world coords while the truck is docked
  target: THREE.Vector3;
}

function slotTargets(): THREE.Vector3[] {
  const slots: THREE.Vector3[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) slots.push(V3((c - (COLS - 1) / 2) * PITCH_X, 0, ROW0_Z - r * PITCH_Z));
  // farthest row first, centre-out alternating sides, so later units never cut through parked ones
  return slots.sort((a, b) => a.z - b.z || Math.abs(a.x) - Math.abs(b.x) || a.x - b.x);
}

const line = (path: THREE.CurvePath<THREE.Vector3>, a: THREE.Vector3, b: THREE.Vector3) =>
  path.add(new THREE.LineCurve3(a, b));
const corner = (path: THREE.CurvePath<THREE.Vector3>, a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3) =>
  path.add(new THREE.QuadraticBezierCurve3(a, c, b));

export function buildRoutes(plans: TruckPlan[]): Route[] {
  const targets = slotTargets();
  const rearZ = DOCK_Z - BED_REAR; // bed rear edge, world z (docked)
  const footZ = rearZ - RAMP_LEN * Math.cos(RAMP_ANG);
  const routes: Route[] = [];
  for (let i = 0; i < N; i++) {
    const truck = Math.floor(i / PER_TRUCK);
    const j = i % PER_TRUCK;
    const lane = j % 2 ? LANE_X : -LANE_X;
    const bed = V3(lane, BED_Y, DOCK_Z - 2.5 + Math.floor(j / 2) * 2.0); // rear pair unloads first
    const target = targets[i];
    const path = new THREE.CurvePath<THREE.Vector3>();
    line(path, bed, V3(lane, BED_Y, rearZ)); // along its bed lane
    line(path, V3(lane, BED_Y, rearZ), V3(lane, 0, footZ)); // down its ramp
    const side = target.x >= 0 ? 1 : -1;
    path.add(
      new THREE.CatmullRomCurve3(
        [
          V3(lane, 0, footZ),
          V3(lane, 0, footZ - 0.8),
          V3(0, 0, GATE_Z + 1.4), // the two lanes merge before the gate
          V3(0, 0, GATE_Z),
          V3(0, 0, GATE_Z - 1.6),
          V3(side * 0.9, 0, GATE_Z - 3.0),
          V3(target.x * 0.85, 0, Math.max(target.z + 2.2, ROW0_Z + 2.0)),
          V3(target.x, 0, target.z + 1.0),
          target.clone(),
        ],
        false,
        "centripetal",
        0.3,
      ),
    );
    const len = path.getLength();
    let gateS = len * 0.4;
    for (let k = 0; k <= 400; k++) {
      if (path.getPointAt(k / 400).z < GATE_Z) {
        gateS = (k / 400) * len;
        break;
      }
    }
    routes.push({ path, len, depart: plans[truck].unload + j * DT, gateS, truck, bed, target });
  }
  return routes;
}

/* ------------------------------------------------------------------ battery swap trips */
export interface SwapTrip {
  unit: number;
  start: number; // stow begins
  outPath: THREE.CurvePath<THREE.Vector3>;
  backPath: THREE.CurvePath<THREE.Vector3>;
  outLen: number;
  backLen: number;
  tOut: [number, number];
  dwell: [number, number];
  tBack: [number, number];
  end: number; // re-tracking done
}

export function buildSwapTrips(routes: Route[]): SwapTrip[] {
  const [sx, , sz] = SWAP_POS;
  const near = sz + SWAP.half + SWAP.ramp; // +z ramp foot (entry)
  const far = sz - SWAP.half - SWAP.ramp; // -z ramp foot (exit)
  const deckIn = sz + SWAP.half;
  const deckOut = sz - SWAP.half;
  const portZ = sz + SWAP.port; // first port from the entry end
  const D = SWAP.deck;
  // three units from the west column, nearest row first (their spacing on the shared loop only grows)
  const west = routes
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.target.x < -(COLS / 2 - 1) * PITCH_X)
    .sort((a, b) => b.r.target.z - a.r.target.z)
    .slice(0, 3);
  return west.map(({ r, i }, k) => {
    const t = r.target;
    const out = new THREE.CurvePath<THREE.Vector3>();
    line(out, t, V3(OUT_LANE + 1.2, 0, t.z));
    corner(out, V3(OUT_LANE + 1.2, 0, t.z), V3(OUT_LANE, 0, t.z), V3(OUT_LANE, 0, t.z + 1.2));
    line(out, V3(OUT_LANE, 0, t.z + 1.2), V3(OUT_LANE, 0, near + 1.2));
    corner(out, V3(OUT_LANE, 0, near + 1.2), V3(OUT_LANE, 0, near + 2.6), V3(OUT_LANE - 1.4, 0, near + 2.6));
    line(out, V3(OUT_LANE - 1.4, 0, near + 2.6), V3(sx + 1.4, 0, near + 2.6));
    corner(out, V3(sx + 1.4, 0, near + 2.6), V3(sx, 0, near + 2.6), V3(sx, 0, near + 1.2));
    line(out, V3(sx, 0, near + 1.2), V3(sx, 0, near));
    line(out, V3(sx, 0, near), V3(sx, D, deckIn)); // up the ramp
    line(out, V3(sx, D, deckIn), V3(sx, D, portZ)); // stop over the port
    const back = new THREE.CurvePath<THREE.Vector3>();
    line(back, V3(sx, D, portZ), V3(sx, D, deckOut));
    line(back, V3(sx, D, deckOut), V3(sx, 0, far)); // down the far ramp
    line(back, V3(sx, 0, far), V3(sx, 0, far - 0.8));
    corner(back, V3(sx, 0, far - 0.8), V3(sx, 0, far - 2.2), V3(sx + 1.2, 0, far - 2.2));
    corner(back, V3(sx + 1.2, 0, far - 2.2), V3(RET_LANE, 0, far - 2.2), V3(RET_LANE, 0, far - 0.9));
    line(back, V3(RET_LANE, 0, far - 0.9), V3(RET_LANE, 0, t.z - 1.2));
    corner(back, V3(RET_LANE, 0, t.z - 1.2), V3(RET_LANE, 0, t.z), V3(RET_LANE + 1.2, 0, t.z));
    line(back, V3(RET_LANE + 1.2, 0, t.z), t.clone());
    const outLen = out.getLength();
    const backLen = back.getLength();
    const start = PHASES.swap[0] + 0.005 + k * 0.03;
    const tOut: [number, number] = [start + 0.012, start + 0.012 + outLen / V_SWAP];
    const dwell: [number, number] = [tOut[1], tOut[1] + 0.025];
    const tBack: [number, number] = [dwell[1], dwell[1] + backLen / V_SWAP];
    return { unit: i, start, outPath: out, backPath: back, outLen, backLen, tOut, dwell, tBack, end: tBack[1] + 0.014 };
  });
}

/* ------------------------------------------------------------------ per-frame poses */
export interface UnitPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  wheel: number;
  mast: number;
  /** 0..1: how far the panel follows the sun (0 = stowed flat) */
  track: number;
  /** passed the wash & inspect gate (violet) / off duty (amber) */
  paired: boolean;
  visible: boolean;
}

export interface Plan {
  trucks: TruckPlan[];
  routes: Route[];
  trips: SwapTrip[];
  tripOf: Map<number, { t: SwapTrip; k: number }>;
}

export function buildPlan(): Plan {
  const trucks = planTrucks();
  const routes = buildRoutes(trucks);
  const trips = buildSwapTrips(routes);
  return { trucks, routes, trips, tripOf: new Map(trips.map((t, k) => [t.unit, { t, k }])) };
}

export interface FrameInfo {
  crossing: boolean; // a unit is under the gate
  swapping: boolean; // a cassette is being swapped
  cassettes: { visible: boolean; x: number; y: number; z: number }[];
}

const _p = new THREE.Vector3();
const _t = new THREE.Vector3();

/** Fill `units` / `trucks` for progress p and report what the scene should light up. */
export function frame(plan: Plan, p: number, trucks: TruckState[], units: UnitPose[]): FrameInfo {
  plan.trucks.forEach((pl, k) => truckPose(pl, k === 0, p, trucks[k]));
  const raise = ss(p, PHASES.raise[0], PHASES.raise[1]);
  const trackAmt = ss(p, PHASES.raise[0] + 0.02, PHASES.track[0] + 0.02);
  const info: FrameInfo = {
    crossing: false,
    swapping: false,
    cassettes: plan.trips.map(() => ({ visible: false, x: 0, y: 0, z: 0 })),
  };

  plan.routes.forEach((r, i) => {
    const u0 = units[i];
    const since = p - r.depart;
    if (since <= 0) {
      // still on its truck: ride along with it (rotate the bed offset by the truck's heading)
      const ts = trucks[r.truck];
      const dx = r.bed.x;
      const dz = r.bed.z - DOCK_Z;
      const a = ts.yaw - Math.PI;
      Object.assign(u0, {
        x: ts.x + dx * Math.cos(a) + dz * Math.sin(a),
        y: BED_Y,
        z: ts.z - dx * Math.sin(a) + dz * Math.cos(a),
        yaw: a,
        pitch: 0,
        wheel: 0,
        mast: -0.18,
        track: 0,
        paired: false,
        visible: ts.visible,
      });
      return;
    }
    const sArc = Math.min(r.len, since * V_ROLL);
    const u = sArc / r.len;
    r.path.getPointAt(u, _p);
    r.path.getTangentAt(Math.min(u, 0.999), _t);
    const moving = u < 1;
    if (Math.abs(sArc - r.gateS) < 1.2) info.crossing = true;
    Object.assign(u0, {
      x: _p.x,
      y: _p.y,
      z: _p.z,
      yaw: moving ? yawOf(_t) : 0,
      pitch: moving ? Math.atan2(_t.y, Math.hypot(_t.x, _t.z)) : 0,
      wheel: -sArc / WHEEL_R,
      mast: -0.18 + 0.28 * raise,
      track: trackAmt,
      paired: sArc > r.gateS,
      visible: true,
    });

    // battery swap trip: stow → out lane → ramp → port (cassette out / in) → far ramp → return lane → re-track
    const hit = plan.tripOf.get(i);
    if (!hit || p <= hit.t.start || p >= hit.t.end) return;
    const trip = hit.t;
    const stow = ss(p, trip.start, trip.tOut[0]) * (1 - ss(p, trip.tBack[1], trip.end));
    u0.mast = lerp(u0.mast, -0.18, stow);
    u0.track *= 1 - stow;
    u0.paired = false; // amber while off station duty
    let seg = trip.outPath;
    let su = 0;
    let base = r.len;
    if (p < trip.tOut[0]) {
      // turning out of the slot toward the out lane
      seg.getTangentAt(0.001, _t);
      u0.yaw = lerpAngle(0, yawOf(_t), ss(p, trip.start + 0.006, trip.tOut[0]));
    } else {
      if (p < trip.tOut[1]) su = (p - trip.tOut[0]) / (trip.tOut[1] - trip.tOut[0]);
      else if (p < trip.dwell[1]) {
        su = 1;
        info.swapping = true;
      } else {
        seg = trip.backPath;
        base += trip.outLen;
        su = Math.min(1, (p - trip.tBack[0]) / (trip.tBack[1] - trip.tBack[0]));
      }
      seg.getPointAt(su, _p);
      seg.getTangentAt(Math.min(Math.max(su, 0.001), 0.999), _t);
      u0.x = _p.x;
      u0.y = _p.y;
      u0.z = _p.z;
      u0.yaw = yawOf(_t);
      u0.pitch = su > 0 && su < 1 ? Math.atan2(_t.y, Math.hypot(_t.x, _t.z)) : 0;
      u0.wheel = -(base + su * (seg === trip.outPath ? trip.outLen : trip.backLen)) / WHEEL_R;
      // back in its slot: turn to face the row again before re-tracking
      if (p >= trip.tBack[1]) u0.yaw = lerpAngle(u0.yaw, 0, ss(p, trip.tBack[1], trip.end - 0.004));
    }
    // the cassette drops out of the belly into the port, and a charged one comes back up
    const d = (p - trip.dwell[0]) / (trip.dwell[1] - trip.dwell[0]);
    Object.assign(info.cassettes[hit.k], {
      visible: d > 0 && d < 1,
      x: u0.x,
      y: SWAP.deck + 0.21 - 0.6 * Math.sin(Math.PI * clamp01(d)),
      z: u0.z,
    });
  });
  return info;
}

/* ------------------------------------------------------------------ camera */
// the establishing flyover (keyed to the original timeline), then over to the swap station
export const CAM_POS = new THREE.CatmullRomCurve3([V3(11, 2.4, 21), V3(8.5, 3.2, 12.5), V3(10, 5.5, 5), V3(15, 10, 0), V3(20, 15, 3), V3(23, 23, 9)]);
export const CAM_LOOK = new THREE.CatmullRomCurve3([V3(0, 1.2, 13), V3(0, 0.9, 5), V3(0, 0.3, -1.5), V3(0, 0, -8), V3(0, 0, -11), V3(0, 0, -12)]);
export const SWAP_CAM = { pos: V3(-1.5, 8.5, 3.5), look: V3(-12, 0.8, -12) };
const CAM_KEYS: [number, number][] = [
  [0, 0],
  [PHASES.arrive[1], 0.1],
  [PHASES.roll[1], 0.7],
  [PHASES.raise[1], 0.8],
  [PHASES.track[1], 1],
];
export function camU(p: number) {
  for (let k = 1; k < CAM_KEYS.length; k++) {
    const [a, ua] = CAM_KEYS[k - 1];
    const [b, ub] = CAM_KEYS[k];
    if (p <= b) return lerp(ua, ub, (p - a) / (b - a));
  }
  return 1;
}
export const toSwapCam = (p: number) => ss(p, PHASES.swap[0], PHASES.swap[0] + 0.06);
