// Sweeps the "From truck to field" choreography (components/three/scenes/deployPlan.ts) and fails if any two
// vehicles overlap: unit↔unit, unit↔truck, truck↔truck, and units against the gate, the swap station and the parked
// truck. Footprints are oriented rectangles in plan (units: stowed panel 1.65 × 1.0 m; trucks 10.4 × 2.6 m).
//
//   node scripts/check-deploy.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(root, "components/three/scenes/deployPlan.ts"), "utf8");
const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const dir = path.join(root, "node_modules/.cache/check-deploy");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "deployPlan.mjs"), out.outputText);
const D = await import(pathToFileURL(path.join(dir, "deployPlan.mjs")).href);

const plan = D.buildPlan();
const trucks = Array.from({ length: D.TRUCKS }, () => ({ x: 0, z: 120, yaw: Math.PI, visible: false }));
const units = Array.from({ length: D.N }, () => ({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, wheel: 0, mast: 0, track: 0, paired: false, visible: false }));

// oriented rectangle: centre (x,z), heading yaw (forward = (-sin, -cos)), half-length along forward, half-width
const rect = (x, z, yaw, hl, hw, off = 0) => {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  return { x: x + fx * off, z: z + fz * off, ax: [[fx, fz], [-fz, fx]], h: [hl, hw] };
};
function overlap(a, b, margin = 0) {
  for (const s of [a, b])
    for (const [ux, uz] of s.ax) {
      const proj = (r) => r.ax.reduce((acc, [vx, vz], i) => acc + r.h[i] * Math.abs(vx * ux + vz * uz), 0);
      const d = Math.abs((b.x - a.x) * ux + (b.z - a.z) * uz);
      if (d >= proj(a) + proj(b) + margin) return false;
    }
  return true;
}
const unitRect = (u) => (u.track > 0.2 ? rect(u.x, u.z, 0, 0.9, 0.9) : rect(u.x, u.z, u.yaw, 0.825, 0.5));
// truck origin sits 0.6 m behind the middle of its 10.4 m footprint (cab toward +forward)
const truckRect = (t) => rect(t.x, t.z, t.yaw + Math.PI, 5.2, 1.3, 0.6);
const statics = [
  ["gate post W", rect(-1.03, D.GATE_Z, 0, 0.31, 0.14)],
  ["gate post E", rect(1.03, D.GATE_Z, 0, 0.31, 0.14)],
  ["swap container", rect(D.SWAP_POS[0], D.SWAP_POS[2], 0, 3.03, 1.22)],
  ["parked truck", rect(D.PARKED_TRUCK[0], D.PARKED_TRUCK[2], 0, 5.2, 1.3)],
];

const problems = [];
let minUnitGap = Infinity;
for (let s = 0; s <= 2000; s++) {
  const p = s / 2000;
  D.frame(plan, p, trucks, units);
  const ur = units.map(unitRect);
  const tr = trucks.map(truckRect);
  for (let i = 0; i < D.N; i++) {
    const a = units[i];
    if (!a.visible) continue;
    const onBed = plan.routes[i].depart >= p;
    for (let j = i + 1; j < D.N; j++) {
      const b = units[j];
      if (!b.visible || Math.abs(a.y - b.y) > 0.9) continue;
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      minUnitGap = Math.min(minUnitGap, d);
      if (overlap(ur[i], ur[j])) problems.push(`p=${p.toFixed(4)} unit ${i} ↔ unit ${j} (centres ${d.toFixed(2)} m)`);
    }
    if (!onBed && a.y < 0.3)
      trucks.forEach((t, k) => {
        if (t.visible && overlap(ur[i], tr[k])) problems.push(`p=${p.toFixed(4)} unit ${i} ↔ truck ${k}`);
      });
    if (a.y < 0.3) for (const [name, r] of statics) if (overlap(ur[i], r)) problems.push(`p=${p.toFixed(4)} unit ${i} ↔ ${name}`);
  }
  for (let k = 0; k < D.TRUCKS; k++)
    for (let m = k + 1; m < D.TRUCKS; m++)
      if (trucks[k].visible && trucks[m].visible && overlap(tr[k], tr[m])) problems.push(`p=${p.toFixed(4)} truck ${k} ↔ truck ${m}`);
}
const uniq = [...new Set(problems.map((l) => l.replace(/^p=[\d.]+ /, "")))];
console.log(`checked 2001 frames · ${D.N} units · ${D.TRUCKS} trucks · closest unit centres ${minUnitGap.toFixed(2)} m`);
if (problems.length) {
  console.log(`${problems.length} overlapping frames:`);
  for (const u of uniq.slice(0, 40)) console.log("  " + u + "  (first at " + problems.find((l) => l.includes(u)).split(" ")[0] + ")");
  process.exit(1);
}
console.log("no overlaps");
