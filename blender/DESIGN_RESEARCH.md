# SolarBot body: reference analysis (Lexus GX 550 / Toyota Land Cruiser 250)

Working notes for the body-surfacing iterations of `solarbot_v2.py`. Sources: the lexus.com GX 360°
visualizer (Eminent White Pearl, 18 angles) and the toyota.com Land Cruiser 360° viewer (Wind Chill
Pearl, plus the gallery close-ups on buyatoyota.com). Robotics/product references at the end are from
general design knowledge, not from those pages.

---

## 1. What the two vehicles are doing

Both are body-on-frame 4x4s from the same platform (TNGA-F). They share a skeleton and a posture:
upright, horizontal and slab-sided, with the wheels pushed to the corners. They then take opposite
positions on how much of the "tool" is shown.

### Shared architecture
| Theme | What it looks like | Why (function) |
|---|---|---|
| **Plinth + body** | A continuous black band wraps the lower ~third of the car: front bumper → arch → rocker → arch → rear bumper. The painted body sits on top of it. | Everything within ~40 cm of the ground gets hit by stones, brush and rocks. Unpainted molded-in-color resin scuffs without showing it and is cheap to replace. Visually it lowers the center of gravity and makes the body read as lifted and tough. |
| **Horizontal shoulder** | One crisp line runs dead level from the headlamp to the tail lamp at hood height. Hood, fender tops and beltline all align to it. | It is the "datum" of the car. In off-road use a level line tells the driver where the corners are, and it makes the body read as one solid block. |
| **Wheels at the corners, tight arches** | Short overhangs. The arch gap to the tire is even all the way round, roughly concentric with the wheel. | Approach and departure angles. An even gap reads as engineered, not styled. |
| **Arches are rounded squares, not polygons** | Both arches read as a squircle: flat-ish top and near-vertical legs, joined by **large radii**. There are no sharp corners and no chamfer facets. | This follows the tire's swept volume at full articulation (a tire moving up and down traces a rounded rectangle, not a circle). It also gives strength at the lip. |
| **Body surfaces are big, taut and slightly convex** | Sides look flat but carry a subtle crown. Highlights run in long smooth bands. The only crisp lines are the shoulder and a few structural creases. | Crown gives panels stiffness (no oil-canning), and it catches light so the body doesn't look like sheet metal. |
| **Face = one dark "mask" framed by body color** | Lamps, grille and sensors are grouped into one dark horizontal zone with body-color corner blocks at each end. | ADAS radar, cameras and lamps all need to sit behind the same zone. One dark band hides their individual shapes and looks calm. |
| **Hardware is honest but integrated** | Tow points, hitch, skid plate, step pads and roof rails are all there. Each is set **into** the plinth or on a molded pad, never bolted onto a flat face. | Recovery and towing are real use cases, but the parts have to look designed-in. |

### Where they diverge
| | **Land Cruiser 250** (tool) | **GX 550** (luxury tool) |
|---|---|---|
| Arch treatment | Chunky **black bolt-on flares** that follow the rounded-square arch and merge into the black bumpers and rockers. The flare *is* the plinth rising up around the wheel. | **Body-color fender blisters**: the painted fender swells outward over each wheel (a "pumped" volume) with only a thin black liner lip. The rocker below is black. |
| Front | **Three-piece bumper**: black center beam with an integrated bash bar and a silver skid plate, plus **body-color corner blocks** (with round fog lamps). The corners are separately replaceable, so a damaged corner is a small part. Rectangular headlamps with three projectors and a DRL bar across the top; separate black grille bar with TOYOTA lettering. | **Spindle mask**: a large dark trapezoid grille set between slim, sharp headlamps. The DRL is a thin horizontal line that kinks into an "L" dropping down the outer edge. Horizontal slat vents in the lower bumper and black lower corner vents. |
| Corners (plan view) | Large-radius corners; the front corner block wraps around to meet the flare. | Similar radius, but the fender blister flows into it so the corner feels sculpted. |
| Rear | Vertical rectangular tail lamps at the **corners** (rounded rectangles); a black rear bumper with a silver step pad and a recessed hitch. | Vertical corner lamps **plus a full-width light bar** joining them. A black bumper with a central hitch cover. |
| Surface mood | Flat and utilitarian, with crisp transitions between blocks. | The same volumes, but more tension: blisters, a sharper L-signature, and pearl paint. |

### How they break the parts (the creative bit)
- **Shut lines sit on feature lines.** The hood edge sits exactly on the shoulder line and bumper splits sit where the plinth meets the body. A seam never crosses a smooth surface for no reason.
- **Black = replaceable, color = structure.** Everything likely to be damaged (bumpers, flares, rockers, corner blocks on the LC) is a separate molded-in-color part.
- **The LC's three-piece bumper** turns a repair constraint into the face design. The corner blocks are the headlamp "cheeks", and the black beam between them becomes the grille surround.
- **Lamps are set into frames.** Every lamp has a narrow body-color or black bezel around it. The glass is never flush with painted metal.
- **Hardware on pads.** Hitches, tow hooks and step pads are recessed into molded pockets, so the bumper surface stays continuous.

---

## 2. What SolarBot needs (vs. what they have)

| Need (robot) | Car analogue | Take it? |
|---|---|---|
| Survive brush, rocks, other robots | Black plinth + flares | **Yes.** One continuous black plinth with the flares grown out of it, not separate parts. |
| Wheels enclosed, no open drivetrain | Arch liners, tight arch gap | **Yes.** Rounded-square arches with an even gap and black liners. |
| Sensing (LiDAR, stereo cameras) + lighting | Dark face mask (GX), headlamps behind glass | **Yes.** One dark smoked face panel holding the LiDAR window, cameras and lamp clusters. |
| Status light visible from any side | DRL signature + full-width tail bar | **Yes.** One continuous light line that runs across the face, drops down the outer edges (GX "L") and wraps the corners onto the flanks. |
| Towing, recovery, docking | Tow hooks, hitch, step pad | **Yes, on pads** recessed into the plinth. |
| Lifting by crane / fork, crew handling | Roof rails, jack points | **Yes.** Roof rails double as grab handles, with lift eyes at their ends. Fork pockets are **removed** (an open hole in the body); instead the flat belly between the wheels takes forks, with two skid runners. |
| Parking shoulder to shoulder | (not a car need) | The plinth's rolled rub rib is the widest point, so units touch rub-to-rub, never paint-to-paint. |
| Solar panel + mast + flat platform | Roof | **Keep.** The top is a flat, slightly crowned platform with a rounded shoulder. |
| Doors, glasshouse, hood | — | **No.** The robot has no cabin, so the upper body is just the "shoulder" volume: a low, wide pearl shell. |

---

## 3. What was wrong with iteration 2 ("wrapped body")
1. **Faceted, not surfaced.** The plan and section were octagons with one bevel. Highlights broke at every chamfer, so it read as cardboard, not molded resin.
2. **The arches were hexagons.** A polygonal arch around a round tire looks cheap. Both references use rounded squares concentric to the wheel.
3. **The flares were stuck on.** They were separate flat slabs with screws, not grown out of the plinth. They stopped abruptly at the bumper and rocker.
4. **The face was busy.** Two separate lamp pods, a sensor slot, a light slot and a chamfer strip were each cut individually. Neither reference does this; each groups everything into one dark field.
5. **No surface tension.** The sides were dead-flat vertical planes with no crown, no blister and no waist.
6. **Utility bolted on.** The fork pockets were open holes, the rub strip was a stick-on bar and the rails had tall posts.

---

## 4. Iteration 3 surfacing plan
- **Analytic, dense surfaces instead of chamfered lofts.** The shell and the plinth are generated as dense structured meshes from functions:
  - The plan is a *rounded rectangle*, so corners are true radii.
  - The section runs a slight tumblehome into a *radiused shoulder* and a gently crowned top.
  - Sides and fascia carry a small crown.
- **Fender blisters (GX).** The pearl shell swells ~2 cm over each wheel and pulls back into a slight waist between them.
- **One black plinth (LC).** It wraps the bumpers, rockers and arches. Around each arch it rolls outward into an integrated **flare lip** that fades smoothly into the rocker and bumper. A rolled **rub rib** at the widest body line.
- **Rounded-square arches** (a squircle concentric with the hub) with an even tire gap, black liners and axle boots.
- **Face mask.** One inset, rounded, dark smoked-glass panel front and rear:
  - Front: three-projector lamp clusters at the ends and a LiDAR/camera window in the center. The light line runs along the top of the mask, drops down its outer edges and wraps around the plan radius onto each flank.
  - Rear: vertical corner lamps joined by a full-width bar (GX).
- **Bumpers are part of the plinth.** A skid plate sits underneath, with tow eyes, the hitch and the dock contacts recessed on pads.
- **Deck**: flush hatches with thin shut lines, low rails with ramped feet and lift slots, GNSS, e-stop.

## 5. Other references (general knowledge)
- **Rivian R1S / R1T**: full-width light bar and "stadium" lamps. This shows how a single light line can be the whole identity; it also wraps the corners.
- **Boston Dynamics Spot / Stretch**: few panels, large radii, hidden fasteners, and a single accent color on functional touchpoints (handles, e-stop). This is the precedent for putting color only where hands go.
- **Monarch MK-V tractor, Clearpath Warthog**: outdoor robots where the rugged part (tires, bumpers) is black and the "product" shell is one clean, light form.
- **Dieter Rams: "as little design as possible."** Every seam, fastener and light has a job; merge parts wherever the function allows.

---

## 6. Iteration log

### Iteration 3: surfaced body (renders in `blender/preview_v2/`, iteration 2 kept in `preview_v2/iter2/`)
Done: the analytic pearl shell and black plinth; rounded-square arches with rolled lips that taper into
the belly; liners and axle boots; GX blisters and waist; one inset face mask with the three-projector
clusters and the "L" light line wrapping the corner radius; a rear bar joining the vertical corner
lamps; recovery eyes, hitch and dock contacts on pads; skid plates; belly runners (fork pockets removed);
flush hatch shut lines.

Open for the next pass (self-critique):
- **Face proportion.** There is a tall plain pearl band above the mask, so the face reads a little
  "appliance". Options:
  - Drop a hood-style shut line onto the shoulder (GX/LC both do this).
  - Make the mask taller, with the lamps in LC-style corner blocks.
- **The blisters are too subtle** at 18 mm. Try about 30 mm, and/or a crisp shoulder crease that the
  blister rises from.
- **The roof rails still read as an accessory.** Consider molded flush grab pockets in the shoulder
  (simpler), keeping the rails only as an optional crane/tie-down accessory.
- **The plinth is visually quiet.** The rub rib barely registers. A contrasting texture band, or a
  step at the rib, would help.
- **Lamp clusters are small** relative to the face. Scale them up about 1.3×.

### Iteration 4: function rationale, sensors, CMF, mark
Asked for: every form traceable to a function; a considered sensor suite; the CMF strategy; a concentric
light ring inside the face mask; simpler recovery points; hub-cap CMF; a maintenance hatch with a latch; a
better bumper-to-arch transition; a new mark, applied as a decal.

---

## 7. Sensor suite: what this robot needs and where it goes

SolarSwarm units drive between rows, park in formation, track the sun, dock to charge and share the site
with people, animals and each other. The field-robot literature points to a standard fused suite:
RTK-GNSS plus an IMU for global pose, LiDAR plus cameras for local perception, wheel odometry, and
ultrasonics for the near field. It also names the failure modes: GNSS occlusion, sun glare, dust, and wheel
slip on loose ground ([Sensors 2026 review](https://pmc.ncbi.nlm.nih.gov/articles/PMC13517332/),
[obstacle-avoidance review](https://www.sciencedirect.com/science/article/pii/S2589721725000819)).
Our own problem: **the robot carries a 1.65 m² panel over its own sensors.**

| Sensor | Job | Placement and why | Form |
|---|---|---|---|
| **Solid-state 3D LiDAR** (front) | Obstacle detection, local map, row following | Center of the face mask, around 0.33 m: under the panel's shadow line and above tall grass. A solid-state unit has no spinning puck to snag or break. | NIR-transmissive window (the violet-tinted rounded rectangle) set into the mask |
| **Stereo camera pair** (front) | Classifies what the LiDAR sees (person / animal / debris), visual odometry | Either side of the LiDAR on the same horizon, for a 0.27 m stereo baseline | Two round lenses in dark rings |
| **Work / IR lamps** (3 per side) | Lets the cameras work at night and at dawn/dusk, when docking and repositioning happen | Mask ends, same horizon as the cameras | Three projector lenses per side (GX-like). They are lamps, not sensors, so they sit outboard. |
| **Corner fisheye cameras** (×4) | 360° surround view: people crouched under the panel, remote teleop, parking alongside neighbors | On the four plan radii at 0.37 m, facing 45°. Each covers two sides, the way car surround-view cameras sit at the corners. | Small dark lens pads flush in the pearl, below the shoulder |
| **Rear camera** | Reversing into the dock, formation spacing | Rear light bar | Round lens in the bar |
| **Ultrasonic array** (4 front + 4 rear) | Near field below the LiDAR's field of view: rocks, animals, a boot, the last centimetres of docking | In the bumper spine at 0.19 m, spaced 0.1 m, like car parking sensors | Flush 21 mm discs in satin black. They are meant to disappear into the plinth. |
| **Dual RTK-GNSS** | Centimetre position; the two antennas' baseline gives heading at standstill | **In two diagonal panel corner caps.** On the deck they would sit under the panel, which blocks the sky. The panel corners are the highest points and are never shaded. | Low dark domes on the corner caps |
| **IMU** (9-DOF), **wheel encoders**, **panel tilt/azimuth encoders** | Dead reckoning between GNSS fixes, slip detection, panel pose | Internal: chassis center, hub motors, slew drives | None visible |
| **Reference irradiance cell** | Measures the sun the panel should be getting; drives tracking and soiling alerts | Panel corner (already in the laminate texture) | A cell in the laminate |
| **Contact safety edge** | Last-resort stop on contact | The plinth's rolled rub rib, which is the widest line on the robot; also the part that touches first when parked shoulder to shoulder | The rub rib |
| **E-stops** (×2) | ISO-style emergency stop reachable from any side | Diagonal deck corners (front-left, rear-right) | Red mushroom heads, the only red on the robot |
| Not on the robot: **anemometer / weather** | Wind-stow decisions are made site-wide at the portal weather mast; each unit also sees wind load through its slew-drive torque | — | — |

## 8. Form → function (every mechanism accounts for itself)
| Form | Function |
|---|---|
| Plinth bumper wrapping the corner into the arch lip | One continuous energy-absorbing band at the height of anything the robot might hit: posts, neighbors, the dock. Because it is continuous, no corner is left unprotected, and the lip and bumper read as one molded part. |
| Rolled arch lips, liners, axle boots | Keep mud and stones off the pearl shell and out of the drivetrain; the arch stays an even distance from the tire as the beams oscillate. |
| Flush recovery covers (front, ×2) | Threaded sockets on the frame horns. The screw-in eye is stowed in the service bay. Nothing stands proud to snag brush, straps or the next unit ([flush tow-eye practice](https://www.carparts.com/blog/how-to-remove-a-tow-eye-cover-quickref/)). |
| Flush hitch plate (rear, ×1) | Tow bar and recovery on the frame centerline, at the same height as the front sockets and the neighbors' bumper spine. |
| Dock contacts (rear, copper) | Nose-to-tail autonomous charging. Copper is used only where energy moves. |
| Belly runners | The flat belly between the wheels takes pallet forks; the runners are the wear surfaces. |
| Roof rails with ramped end feet | Crew grab handles (for lifting a wheel over a curb or steadying a unit on a trailer), with tie-down/lift slots in the end feet. Rails sit inboard of the shoulder so the panel can sweep low past them. |
| Maintenance hatch with flush paddle latch and key lock | Opens onto the service bay (fuses, BMS, compute, the stowed tow eye). Gasketed, hinged on the mast side so it opens away from the person at the rear. The paddle pocket is sized for gloves, and the key lock prevents casual access ([Southco flush paddle latches](https://southco.com/en_any_int/latches/push-to-close-latches/paddle-latches)). Everything stays flush so the panel and straps can't catch. |
| Face mask with concentric light ring | Sensor glazing, lamps and status share one cleanable dark field. The light ring runs concentric inside the mask edge (the GX "L" turned into a frame) and marks the robot's "front" at a glance. |
| Corner light wraps, side status line, mast status ring | Status visible from every side: the front shows white/violet, the rear amber; the flanks and the mast carry fleet state. |
| Fender blisters and waist | Clearance for the arches without widening the whole body, and a stiffer shell (a crowned panel resists oil-canning). |

## 9. CMF: color, material and finish
CMF sets how a product looks, feels and wears. Its rules are useful here: matte and textured finishes hide
scratches and give grip on touch points; high contrast marks safety features; finishes follow the
manufacturing process ([Color Material Design](https://www.colormaterialdesign.com/journal/intro-to-cmf-design),
[StudioRed](https://www.studiored.com/blog/encyclopedia/color-material-finish-cmf/),
[Formlabs](https://formlabs.com/blog/what-is-cmf-color-material-finish-opportunities-for-3d-printing/)).

| Zone | Material / process | Finish | Why |
|---|---|---|---|
| **Pearl shell + hatch** | PC/ASA, 2K pearl paint + clear coat | Gloss | Light color keeps the battery bay cool in the sun. The shell is the brand surface, and gloss is easy to wash. It sits above the damage line. |
| **Plinth, arch lips, rail feet** | Molded-in-color black **ASA** (UV-stable, no paint to chip) ([ASA vs ABS](https://textileus.com/asa-vs-abs/)) | Grained, VDI 3400 #30–33 class (scratch-hiding) ([VDI 3400](https://www.plastopialtd.com/vdi-3400/)) | Everything below about 0.27 m gets hit, so it must not show it. |
| **Recovery covers, ultrasonic faces** | Black ASA / PC | Satin (smoother than the plinth) | Reads as a separate service part without breaking the black band |
| **Face mask, rear bar, lamp lenses** | PMMA/PC dark smoked; NIR-transmissive window over the LiDAR | High gloss | Glazing must be optically clean and wipeable |
| **Rails, bolt boss, hitch plate, latch paddle** | Aluminium, hard-anodized dark / gunmetal | Satin metallic | Structural metal parts are honestly metal, and dark so they don't glint |
| **Hub caps** | Molded black ASA | **Matte dark grey** | No glare beside the pearl rim; hides scuffs from curbs and brush |
| **Hub bolts** | Steel, black e-coat + clear | **Gloss black** | Reads as hardware without chrome sparkle; different from the boss |
| **Copper** | Copper / copper-tone | Satin | **Energy only**: dock contacts, status-ring collar, slew-drive seals |
| **Violet light** | LED | — | Autonomous / fleet status (the brand violet). The only other lit colors: amber at the rear, red on the e-stops. |
| **Mark decals** | Printed polymer film | Matte | Ink on pearl, with the violet panel bar as the single brand accent |

## 10. The mark
The robot reduced to four shapes, side view: **panel, mast, body, wheels**.
- The body keeps the robot's arch language: two arches cut concentric with the wheels, with a 1.1-unit gap.
- The wheels sit at the corners, as they do on the robot.
- The panel bar carries the swarm-violet gradient because it is the part that makes energy. Everything else
  is ink or `currentColor`, so the mark follows light and dark themes.
- It holds together down to 16 px.

`blender/logo.py` is the single source. It writes `public/brand/solarswarm-mark-{color,mono,inverse}.svg`,
drives `components/ui/logo.tsx`, and builds the same polygons as decals on the robot (both flanks and the
front deck).

---

## 11. The rest of the fleet: transporter truck and pairing portal (`blender/props_v2.py`)
The same rules as the robot apply: surfaced volumes, a black band low down where things get hit, pearl
above, one dark "mask" with a concentric light ring, copper only for energy, the robot's hub CMF, and the
mark as a decal. Every feature has to earn its place.

| Truck feature | Function |
|---|---|
| Battery-electric cab-over, raked only above the lamp line | A short cab leaves the most bed length for robots. Keeping the lamp zone vertical keeps the headlamp mask flat and the lights aimed. |
| One dark glasshouse band around the cab | Windshield and side glass read as one mask, the truck's version of the robot's face. |
| Black plinth bumper wrapping into rolled front-arch lips | The same energy-absorbing band and arch language as the robot, at truck scale |
| Face mask with a concentric light ring and three projectors per side | The robot's light signature, scaled up. Headlamps are functional; the ring doubles as the DRL. |
| Pearl skirts over the battery packs, black lower strip | No exposed packs or cabling. The skirt carries the mark; the black strip takes road spray. |
| Charge port door (copper ring) | Depot charging; copper marks energy |
| Two-lane bed with gunmetal guide rails at the robot's track, flush tie-downs, grip deck | Each robot drives on and off in its own lane; nothing stands proud to snag. The tie-downs are flush for the same reason. |
| Pearl headboard with an arched light line and the mark | Protects the cab. It is the truck's billboard when it is reversing into a site. |
| Rear corner posts with vertical "]" tail brackets | The robot's rear lamp language; posts sit outboard of the ramp path |
| Camera mirrors, comms fin, roof work-light bar | Fewer snag points than glass mirrors; fleet comms; lighting for night offloading |
| Hubs: matte-grey cap, gunmetal boss, gloss-black bolts | Same CMF as the robot |

| Portal feature | Function |
|---|---|
| Pearl posts and beam, black ballast feet with four anchor bolts | A free-standing gate, anchored without footings; the feet take bumps from passing units |
| Dark band framing the opening with a light ring concentric inside it | The robot's mask ring at gate scale; it pulses as each unit crosses (`LED_Portal`, animated in `DeployScene`) |
| Downward sensor mask under the beam: 4 cameras + UWB/NFC reader | Identifies and pairs each unit as it passes under |
| PV strip on the beam top | The gate powers itself; no trenching for a temporary gate |
| Mark on the beam faces | Brand at the point where the robots "join" the fleet |

## 12. Web pipeline
- `blender/export_v2.py` builds the robot at web resolution (`v2.Q`), then:
  - drops internal and enclosed parts (packaging, drive beams);
  - applies modifiers and decimates to a triangle budget;
  - merges parts per (rig node, material) so `<Swarm/>` draws one `InstancedMesh` per merged part.
- Two outputs:
  - **Hero** `solarbot.glb`: about 209k triangles, 61 meshes, 1.0 MB.
  - **Swarm LOD** `solarbot_lod.glb`: about 41k triangles, 52 meshes, 0.3 MB. It has smooth tires, a flat panel back, and no sub-3 cm hardware.
- All GLBs are **Draco-compressed**. The decoder is self-hosted in `public/draco/` (`DRACO` in
  `components/three/assets.ts`), and model URLs carry a version query so re-exports aren't served stale.
- The rig contract is unchanged: `wheel_*`, `mast_height`, `panel_azimuth`, `panel_tilt`, and the `LED_*`
  materials.
- `render_scenes.py` now renders every marketing still with the v2 robot, truck and portal
  (`blender/render_all.sh`). `SS_RENDER_OUT` redirects test renders away from `public/renders/`.

---

## 13. Iteration 5: why the gate exists, the swap station, and the belly cassette

### The gate is a wash-and-inspect station (it used to be a "pairing portal")
Pairing is software. It needs no hardware, so the old portal had no job. Two things in the field genuinely
are physical:
- **Soiling.** Dust costs yield, and the app already schedules a "wash route".
- **Sensor trust.** You want proof that each unit's cameras and LiDAR are calibrated before it drives among
  people.

The gate does both, like a car wash:
- Units roll through with the panel stowed flat (glass at about 1.17 m).
- A deionized **mist bar** wets the glass, a **floating brush roller** (sprung to follow panel height) cleans
  it, and an **air knife** dries it.
- A **camera tunnel** images every cell for cracks and soiling.
- **Checkerboard targets** on the inner faces of the posts let each unit verify its own cameras and LiDAR.
- Water drains through a **drive-over grate** into recirculating tanks in the feet. A PV strip on the hood
  powers it.

It is used at offload (commissioning) and afterwards on the wash route.

### Energy logistics: the battery swap station
Units don't need to be wired to the site; they carry their energy.
- A **half-height 20-ft module** (6.06 × 2.44 × 1.1 m) with ISO castings, so the same truck delivers it.
- **12.4° ramps** (the unit is rated for ±15°) lead up to a deck lane: grip deck, curbs at the unit's
  track, and guide strips for the belly runners.
- **Two swap ports**, each with a concentric light ring that marks where to stop. Inside:
  1. A lift rises under the port.
  2. Two cones find the cassette's alignment sockets.
  3. The latches release.
  4. The cassette drops into a **two-tier charging rack** on copper bus rails.
  5. A charged cassette goes back up.
- **The rack is the site battery.** An inverter and grid tie at the end wall (copper gland) feed site
  loads or export. Louvers at the rack ends manage heat. A service door on the side gives access to the rack.
- The ramps fold onto the deck for transport.

### Robot: drop-out battery cassette
- The 5 kWh LFP pack is now a 0.3 × 0.6 m cassette between the belly runners, in a bay molded into the
  plinth.
- From below you can see:
  - four gunmetal **latch pins**;
  - two **alignment sockets** that the lift's cones find;
  - a recessed **blind-mate power/data connector** (copper);
  - a **finger pull** for a manual swap.
- The top hatch is now the **service bay** for compute and fuses.
- The **belly runners** are the lane guides on the swap deck, as well as the fork runners.

### Mark, simplified
Three round-capped strokes of one weight:
- the **panel at 45°**, balanced on the mast top, in violet (lifted on dark backgrounds);
- the vertical **mast**;
- the horizontal **base**.

It reads as a sun tracker at 16 px. `blender/logo.py` still generates everything: the SVGs, `app/icon.svg`,
the `Logo` component and the decals.

### Lesson: realtime materials ≠ offline materials
The v2 exports carried **KHR_materials_anisotropy** (brushed aluminium). In three.js, anisotropy builds its
tangent frame from UVs. The procedural v2 parts have no UVs, so the frame evaluated to NaN, and the bloom/AO
passes spread the NaN over the whole frame: every 3D section rendered black, with no console error. Web
exports now go through `export_v2.web_materials()`: anisotropy and transmission are off, and glazing becomes
a thin alpha coat. **Rule: validate web models in the web renderer (pixel read-back), not only by
re-importing them.**

## 14. The deploy story as a plan (collision-free by construction, checked by script)
`components/three/scenes/deployPlan.ts` is the choreography; `DeployScene.tsx` only renders it.

**Delivery**
- **A convoy of four flatbeds, six units each** (4 × 6 = 24). A fifth, parked flatbed is the one that
  dropped the swap station.
- Trucks back in from a **queue spot** clear of the dock. The empty truck pulls forward into an **exit
  lane** before the next one reverses in.
- Each truck has **two bed-lane ramps**, 5 m at 14.8°, inside the unit's ±15° slope rating.

**Formation**
- Units move at a **constant speed**, with departures spaced **2.6 m** apart along shared paths (a unit is
  1.4 m long; its stowed panel is 1.65 m).
- The two lanes merge before the **wash & inspect gate**.
- Slots fill **farthest first, centre-out, alternating sides**, so nobody cuts through a parked unit.

**Battery swap**
1. Three west-column units stow and take the **out lane**.
2. Each one climbs the station ramp and stops over the first port. The cassette drops out of the belly and a
   charged one rises; the port ring pulses.
3. It continues down the far ramp and up the separate **return lane**, then turns back into its slot and
   re-tracks.

Trips are spaced so the follower never closes within 2.5 m, even while the leader dwells over the port.

**Check:** `npm run check:deploy` sweeps 2,001 frames. It tests every unit↔unit, unit↔truck and truck↔truck
pair with oriented footprints, plus every unit against the gate posts, the swap container and the parked
truck. It currently passes with no overlaps; a seeded 0.8 m spacing makes it fail, which proves the check is
live.
