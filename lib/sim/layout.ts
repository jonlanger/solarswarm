/**
 * Site layout planning for onboarding — pure geometry, no React.
 *
 * Everything works in local metres (x = east, y = north) around an origin, so a drawn perimeter can be filled with
 * a unit grid, and the truck drop-off and battery-swap container can be snapped to its edges.
 */

export type XY = [number, number];
export type LngLat = [number, number];

const M_PER_DEG = 111_320;

export function toLocal(origin: LngLat, p: LngLat): XY {
  const k = Math.cos((origin[1] * Math.PI) / 180);
  return [(p[0] - origin[0]) * M_PER_DEG * k, (p[1] - origin[1]) * M_PER_DEG];
}

export function toLngLat(origin: LngLat, p: XY): LngLat {
  const k = Math.cos((origin[1] * Math.PI) / 180);
  return [origin[0] + p[0] / (M_PER_DEG * k), origin[1] + p[1] / M_PER_DEG];
}

const sub = (a: XY, b: XY): XY => [a[0] - b[0], a[1] - b[1]];
const add = (a: XY, b: XY): XY => [a[0] + b[0], a[1] + b[1]];
const mul = (a: XY, k: number): XY => [a[0] * k, a[1] * k];
const len = (a: XY) => Math.hypot(a[0], a[1]);
const rot = (p: XY, a: number): XY => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
export const dist = (a: XY, b: XY) => len(sub(a, b));

/** Signed shoelace area (positive = counter-clockwise). */
function signedArea(poly: XY[]) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

export const polygonArea = (poly: XY[]) => Math.abs(signedArea(poly));

export function centroid(poly: XY[]): XY {
  const n = poly.length || 1;
  return poly.reduce<XY>((c, p) => [c[0] + p[0] / n, c[1] + p[1] / n], [0, 0]);
}

export function pointInPolygon(p: XY, poly: XY[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function closestOnSegment(p: XY, a: XY, b: XY): { q: XY; t: number } {
  const ab = sub(b, a);
  const l2 = ab[0] ** 2 + ab[1] ** 2 || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / l2));
  return { q: add(a, mul(ab, t)), t };
}

function distToEdges(p: XY, poly: XY[]) {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) d = Math.min(d, dist(p, closestOnSegment(p, poly[i], poly[(i + 1) % poly.length]).q));
  return d;
}

/** Angle (radians) of the longest perimeter edge, folded into (-90°, 90°]. */
export function longestEdgeAngle(poly: XY[]) {
  let best = 0;
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const e = sub(poly[(i + 1) % poly.length], poly[i]);
    if (len(e) > best) {
      best = len(e);
      a = Math.atan2(e[1], e[0]);
    }
  }
  if (a > Math.PI / 2) a -= Math.PI;
  if (a <= -Math.PI / 2) a += Math.PI;
  return a;
}

export interface Slot {
  p: XY;
  row: number;
  col: number;
}

/**
 * Fill a perimeter with a unit lattice. `angle` rotates the rows (0 = rows run east-west); every slot keeps
 * `setback` metres from the fence. The lattice phase is centred on the polygon so the margins come out even.
 */
export function gridSlots(poly: XY[], o: { pitchX: number; pitchY: number; setback: number; angle: number }): Slot[] {
  if (poly.length < 3) return [];
  const c = centroid(poly);
  const local = poly.map((p) => rot(sub(p, c), -o.angle));
  const xs = local.map((p) => p[0]);
  const ys = local.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const nx = Math.floor((x1 - x0) / o.pitchX);
  const ny = Math.floor((y1 - y0) / o.pitchY);
  if (nx * ny > 40_000) return []; // absurdly large lot — refuse rather than hang
  const ox = x0 + (x1 - x0 - nx * o.pitchX) / 2 + o.pitchX / 2;
  const oy = y0 + (y1 - y0 - ny * o.pitchY) / 2 + o.pitchY / 2;
  const out: Slot[] = [];
  for (let r = 0; r < ny; r++)
    for (let col = 0; col < nx; col++) {
      const q: XY = [ox + col * o.pitchX, oy + (ny - 1 - r) * o.pitchY];
      if (!pointInPolygon(q, local) || distToEdges(q, local) < o.setback) continue;
      out.push({ p: add(rot(q, o.angle), c), row: r, col });
    }
  return out;
}

/* ------------------------------------------------------------ infrastructure */

export type InfraKind = "dropoff" | "swap";

/** Footprints (metres). `along` runs parallel to the fence, `depth` into the site. */
export const INFRA: Record<InfraKind, { along: number; depth: number; label: string; clearance: number }> = {
  // ramp landing + wash & inspect gate; the flatbed itself parks outside the fence
  dropoff: { along: 10, depth: 9, label: "Truck drop-off", clearance: 1.5 },
  // 40 ft container (12.2 × 2.44 m) with a drive-through lane each side
  swap: { along: 14, depth: 8, label: "Battery swap", clearance: 1.5 },
};
export const TRUCK = { length: 16.5, width: 2.6 };

export interface Placed {
  kind: InfraKind;
  /** point on the fence */
  anchor: XY;
  /** footprint corners, inside the fence */
  corners: XY[];
  /** flatbed outline outside the fence (drop-off only) */
  truck?: XY[];
  center: XY;
}

/** Nearest point on the perimeter plus the edge's direction and inward normal. */
export function snapToPerimeter(poly: XY[], p: XY) {
  const ccw = signedArea(poly) > 0;
  let best = { q: poly[0], d: Infinity, dir: [1, 0] as XY, inward: [0, 1] as XY };
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const { q } = closestOnSegment(p, a, b);
    const d = dist(p, q);
    if (d < best.d) {
      const e = sub(b, a);
      const dir = mul(e, 1 / (len(e) || 1));
      // left normal points inside a counter-clockwise ring
      const inward: XY = ccw ? [-dir[1], dir[0]] : [dir[1], -dir[0]];
      best = { q, d, dir, inward };
    }
  }
  return best;
}

export function placeInfra(poly: XY[], kind: InfraKind, near: XY): Placed {
  const { q, dir, inward } = snapToPerimeter(poly, near);
  const { along, depth } = INFRA[kind];
  const h = mul(dir, along / 2);
  const d = mul(inward, depth);
  const corners: XY[] = [sub(q, h), add(q, h), add(add(q, h), d), add(sub(q, h), d)];
  const placed: Placed = { kind, anchor: q, corners, center: add(q, mul(inward, depth / 2)) };
  if (kind === "dropoff") {
    const w = mul(dir, TRUCK.width / 2);
    const out = mul(inward, -TRUCK.length);
    const g = mul(inward, -0.8); // gap for the ramps' fence gate
    placed.truck = [add(q, add(g, w)), add(q, sub(g, w)), add(q, add(sub(g, w), out)), add(q, add(add(g, w), out))];
  }
  return placed;
}

function inQuad(p: XY, quad: XY[], pad: number) {
  // quad is a rectangle: test in its own frame
  const o = quad[0];
  const u = sub(quad[1], o);
  const v = sub(quad[3], o);
  const lu = len(u);
  const lv = len(v);
  const r = sub(p, o);
  const a = (r[0] * u[0] + r[1] * u[1]) / lu;
  const b = (r[0] * v[0] + r[1] * v[1]) / lv;
  return a > -pad && a < lu + pad && b > -pad && b < lv + pad;
}

export function slotBlocked(s: XY, placed: Placed[]) {
  return placed.some((pl) => inQuad(s, pl.corners, INFRA[pl.kind].clearance));
}

/** Perimeter samples every `step` metres. */
function perimeterSamples(poly: XY[], step: number): XY[] {
  const out: XY[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const n = Math.max(1, Math.floor(dist(a, b) / step));
    for (let k = 0; k < n; k++) out.push(add(a, mul(sub(b, a), (k + 0.5) / n)));
  }
  return out;
}

/**
 * Suggest where the truck drops units and where the swap container goes.
 * - Drop-off: the fence point closest to road access (if we know a road), otherwise the middle of the longest edge.
 * - Swap container: the fence point that minimises the average battery run from the formation, kept clear of the
 *   truck lane so deliveries and swaps never share an apron.
 */
export function suggestInfra(poly: XY[], slots: XY[], road?: XY) {
  let dropNear: XY;
  if (road) dropNear = road;
  else {
    let best = -1;
    dropNear = poly[0];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if (dist(a, b) > best) {
        best = dist(a, b);
        dropNear = mul(add(a, b), 0.5);
      }
    }
  }
  const dropoff = placeInfra(poly, "dropoff", dropNear);

  const sample = slots.length > 400 ? slots.filter((_, i) => i % Math.ceil(slots.length / 400) === 0) : slots;
  let swap: Placed | null = null;
  let bestScore = Infinity;
  for (const p of perimeterSamples(poly, 3)) {
    const cand = placeInfra(poly, "swap", p);
    const gap = dist(cand.center, dropoff.center);
    if (gap < 22) continue; // keep the truck apron and the swap lanes apart
    const cornersIn = cand.corners.every((c) => pointInPolygon(c, poly) || distToEdges(c, poly) < 0.5);
    if (!cornersIn) continue;
    const avg = sample.reduce((s, q) => s + dist(q, cand.center), 0) / (sample.length || 1);
    if (avg < bestScore) {
      bestScore = avg;
      swap = cand;
    }
  }
  // tiny lots: fall back to the opposite side of the drop-off
  if (!swap) swap = placeInfra(poly, "swap", sub(mul(centroid(poly), 2), dropoff.anchor));
  return { dropoff, swap };
}

/**
 * Choose which open slots get units: the ones nearest `focus` (the swap container once it's placed, so battery runs
 * stay short). Returns indices into `open`.
 */
export function pickSlots(open: XY[], count: number, focus: XY) {
  return open
    .map((p, i) => ({ i, d: dist(p, focus) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map((x) => x.i);
}
