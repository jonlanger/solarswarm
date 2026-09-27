# SolarSwarm

Autonomous, sun-tracking solar robots: a marketing site and a fleet-management + energy platform, built from the
[Automated Solar Field](https://jonlanger.vercel.app/projects/solar-field-installation) concept.

```bash
npm install     # also copies the MapLibre worker into public/maplibre
npm run dev     # http://localhost:3000
```

## What's here

| Route | |
|---|---|
| `/` | Homepage: live 3D hero, scroll-driven truck → portal → formation deployment, interactive sun tracking vs fixed tilt, robot anatomy, audiences (buyer/renter · seller/lessor · SolarSwarm Ops), gallery |
| `/design-system` | Living token + component reference (swarm violet gradient, battery copper, light/dark) |
| `/app` | Platform overview, role-aware; switch roles in the header or with `?role=buyer|lessor|ops` |
| `/app/map` | MapLibre fleet map: Sentinel-2 imagery, drone-ortho overlays, live unit status, 3D twin drawer |
| `/app/robots`, `/app/robots/[id]` | Fleet table, unit detail with digital twin, health trends, remote actions |
| `/app/energy` | Solar in, storage, load, grid export/import, tracking gain, settlement |
| `/app/maintenance` | Predictive failure forecast, work orders, soiling, support tickets |
| `/app/onboarding` | Register → site → layout → animated deploy → commission (units join the live fleet) |

## How it's built

- **Design tokens** live in `lib/tokens.css` (raw ramps → semantic tokens, dark mode redefined, not inverted) and are
  mapped into Tailwind v4 in `app/globals.css`. Primitives in `components/ui/`. The chart palette is CVD-validated.
- **3D**: a single procedural Blender model (`blender/build_robot.py`) is the source for the Cycles renders *and* the
  rigged GLBs (`public/models/solarbot.glb`, `solarbot_lod.glb`). The rig node names (`mast_height`, `panel_azimuth`,
  `panel_tilt`, `wheel_*`, `LED_*` materials) are the contract with `components/three/Robot.tsx`. Hundreds of units render
  through `Swarm.tsx` (one InstancedMesh per part).
- **Sun**: `lib/sun.ts` wraps suncalc (2.x returns degrees from north; normalized there) and derives dual-axis tracking
  poses. The same ephemeris drives the 3D panels and the energy model.
- **Simulation** (`lib/sim/`): seeded world of sites, units, leases and tickets; per-site clear-sky energy model with
  battery dispatch; wear-driven health → risk → failure predictions. The header clock supports time-warp (1×–3600×).
- **Mapping**: MapLibre GL with EOX Sentinel-2 cloudless 2016 (CC BY 4.0) and OpenFreeMap / OpenStreetMap. No keys.

## Regenerating renders

```bash
BL=/Applications/Blender.app/Contents/MacOS/Blender
$BL -b -P blender/build_robot.py            # hero GLB
$BL -b -P blender/build_robot.py -- --low   # swarm LOD GLB
$BL -b -P blender/export_props.py           # truck + portal GLBs
blender/render_all.sh                       # Cycles stills (hero, studio, array, formation, onboarding, …)
$BL -b -P blender/render_scenes.py -- ortho_mojave ortho_valley ortho_permian ortho_piedmont --samples 96
for f in public/renders/*.png; do case $f in *ortho_*) ;; *) sips -s format jpeg -s formatOptions 84 "$f" --out "${f%.png}.jpg";; esac; done
```

Attribution: Sentinel-2 cloudless by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016) ·
© OpenStreetMap contributors · OpenFreeMap.
