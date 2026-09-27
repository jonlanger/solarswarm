// MapLibre 6 runs its worker as an ES module that imports a shared chunk. Serve both from /public
// so the bundler never has to resolve the worker URL (Turbopack doesn't).
import { copyFileSync, mkdirSync } from "node:fs";

const src = "node_modules/maplibre-gl/dist";
const out = "public/maplibre";
mkdirSync(out, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(`${src}/${f}`, `${out}/${f}`);
console.log("maplibre worker copied to", out);
