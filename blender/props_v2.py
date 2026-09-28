"""Transporter truck, wash & inspect gate and battery swap station, in the robot's v2 design language
(see DESIGN_RESEARCH.md §11, §13).

  Blender -b -P blender/props_v2.py            # export public/models/truck.glb, portal.glb, swap_station.glb

Same rules as the robot: surfaced (radiused, crowned) volumes instead of boxes; a black plinth low down where
things get hit, pearl above; one dark face mask with a concentric light ring; copper only where energy moves;
matte-grey hubs with a gunmetal boss and gloss-black bolts; the mark as a decal. Every feature has a job:
  truck  — battery-electric cab-over; battery packs behind pearl skirts (no exposed egress); a two-lane bed
           with guide rails and flush tie-downs sized to the robot's track; charge port on the skirt; camera
           mirrors; tail brackets like the robot's. Also carries the swap station (ISO castings / twistlocks).
  gate   — (portal.glb) wash & inspect: mist bar, floating brush roller and air knife clean the stowed panel; a
           camera tunnel images the cells; checkerboard targets on the posts verify each unit's cameras / LiDAR;
           drive-over drain grate into recirculating tanks in the feet; PV on the hood; the concentric light ring
           pulses as units pass. Used at offload (commissioning) and on the field wash route.
  swap   — half-height 20-ft module: ramps up to a deck lane with two swap ports; a lift drops each unit's belly
           cassette into a charging rack and returns a charged one; the rack is the site battery (inverter + grid
           tie at the end wall).
Frames: Blender X right, Y forward (truck cab faces +Y), Z up. Contract with DeployScene.tsx: bed deck at
z≈1.3, bed rear edge at y≈-4.3 (ramp hinge), stowed robots at x=±0.62, y=-2.5/-0.5/1.5; the gate is centered on its
origin, units enter from -Y (three.js +Z), its lights use LED_* materials.
"""

import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_robot as br  # noqa: E402
import solarbot_v2 as v2  # noqa: E402
from build_robot import srgb, _principled  # noqa: E402


MARK = 0.22  # one mark size on every prop surface, centred in a clear pearl field (≥ ~0.1 m margin all round)


def mats():
    M = v2.materials(os.path.join(br.ROOT, "public", "models", "textures"))
    M["tail"] = _principled("LED_Tail", srgb("#ff4a3d"), rough=0.3,
                            **{"Emission Color": (*srgb("#ff3a2e"), 1.0), "Emission Strength": 12.0})
    M["headlamp"] = _principled("Headlamp", (1, 1, 1), rough=0.2,
                                **{"Emission Color": (1.0, 0.96, 0.9, 1.0), "Emission Strength": 18.0})
    M["portal_led"] = _principled("LED_Portal", srgb("#b99aff"), rough=0.3,
                                  **{"Emission Color": (*srgb("#9d6bff"), 1.0), "Emission Strength": 12.0})
    M["deck_grip"] = _principled("Deck_Grip", srgb("#2a2a30"), metallic=0.8, rough=0.55)
    M["brush"] = _principled("Brush_Bristle", srgb("#2b2833"), rough=0.9, **{"Sheen Weight": 0.6})
    return M


def block(name, x0, x1, y0, y1, z0, z1, r, top=0.0, bot=0.0, rake=0.0, taper=0.0, steps=8):
    """Rounded-rectangle solid with radiused top / bottom edges. `rake` pulls the +Y face back toward the top
    (vertical over the lower 30 %, then easing back — lamps stay upright, the windshield leans), `taper` narrows
    the half-width toward the top (both in meters at z1)."""
    if bot:
        prof = [(z0 + bot * (1 - math.sin(p)), bot * (1 - math.cos(p))) for p in np.linspace(math.pi / 2, 0, steps)]
    else:
        prof = [(z0, 0.0)]
    if top:
        prof += [(z1 - top + top * math.sin(p), top * (1 - math.cos(p))) for p in np.linspace(0, math.pi / 2, steps)]
    else:
        prof += [(z1, 0.0)]
    rings = []
    for z, d in prof:
        t = (z - z0) / (z1 - z0)
        yy1 = y1 - rake_at(rake, t)
        hw = (x1 - x0) / 2 - d - taper * t
        hl = (yy1 - y0) / 2 - d
        R = max(min(r - d, hw - 0.002, hl - 0.002), 0.004)
        cx, cy = (x0 + x1) / 2, (y0 + yy1) / 2
        rings.append([(cx + x, cy + y, z) for x, y, _, _ in v2.plan_ring(hw, hl, R)])
    return v2.ring_loft(name, rings)


def rake_at(rake, t):
    return rake * max(0.0, (t - 0.3) / 0.7) ** 1.5


def sarch(yc, zc, A, H, zb, d=0.0, n=48, e=3.0):
    """Rounded-square arch in YZ (rear leg -> top -> front leg), grown by d."""
    A, H = A + d, H + d
    pts = [(yc - A, zb)]
    for i in range(n + 1):
        th = math.pi * (1 - i / n)
        c, s = math.cos(th), math.sin(th)
        pts.append((yc + A * math.copysign(abs(c) ** (2 / e), c), zc + H * abs(s) ** (2 / e)))
    pts.append((yc + A, zb))
    return pts


def lip(name, pts, x_face, sx, M, parent, scale=2.4):
    """Rolled arch lip swept along an arch on a flat flank at |x| = x_face (the robot's lip, scaled up)."""
    sec = [(-0.005, -0.014), (-0.005, 0.006), (0.0, 0.016), (0.008, 0.021), (0.02, 0.019), (0.034, 0.01),
           (0.046, 0.0), (0.046, -0.014)]
    sec = [(u * scale, v * scale) for u, v in sec]
    path = []
    for i, (y, z) in enumerate(pts):
        y0, z0 = pts[max(i - 1, 0)]
        y1, z1 = pts[min(i + 1, len(pts) - 1)]
        t = Vector((0, y1 - y0, z1 - z0)).normalized()
        path.append((Vector((sx * x_face, y, z)), Vector((0, -t.z, t.y)), Vector((sx, 0, 0))))
    v2.fin(v2.sweep(name, path, sec), M["cladding"], parent)


def light_ring(name, cx, cz, hw, hh, r, y, facing, mat, parent, sides=True, w=0.004, k=12):
    """Light guide concentric inside a rounded-rect mask (in the XZ plane at y): top + both sides."""
    path = []
    zc0 = cz - hh + r
    if sides:
        path += [(cx - hw, z, -1.0, 0.0) for z in np.linspace(zc0, cz + hh - r, 6)]
    for i in range(0 if not sides else 1, k):
        a = math.radians(180 - 90 * i / k)
        path.append((cx - hw + r + r * math.cos(a), cz + hh - r + r * math.sin(a), math.cos(a), math.sin(a)))
    path += [(x, cz + hh, 0.0, 1.0) for x in np.linspace(cx - hw + r, cx + hw - r, 24)]
    for i in range(1, k if sides else k + 1):
        a = math.radians(90 - 90 * i / k)
        path.append((cx + hw - r + r * math.cos(a), cz + hh - r + r * math.sin(a), math.cos(a), math.sin(a)))
    if sides:
        path += [(cx + hw, z, 1.0, 0.0) for z in np.linspace(cz + hh - r, zc0, 6)]
    frames = [(Vector((x, y, z)), Vector((nx, 0, nz)), Vector((0, facing, 0))) for x, z, nx, nz in path]
    v2.fin(v2.sweep(name, frames, [(-w / 2, 0.0), (w / 2, 0.0), (w / 2, w * 0.7), (-w / 2, w * 0.7)]), mat, parent)


def hub_wheel(tag, x, y, R, width, M, parent, duals=False):
    """Truck wheel with the robot's hub CMF: matte-grey cap, gunmetal boss, gloss-black bolts."""
    side = 1 if x > 0 else -1
    tire_w = width * (2.05 if duals else 1)
    v2.cyl(f"tire_{tag}", R, tire_w, (x, y, R), M["rubber"], parent, axis="X", verts=72, bevel=0.07, seg=5)
    if duals:
        v2.cyl(f"tire_groove_{tag}", R + 0.002, 0.03, (x, y, R), M["cavity"], parent, axis="X", verts=72)
    face = x + side * tire_w / 2
    v2.cyl(f"rim_{tag}", R * 0.62, 0.03, (face - side * 0.01, y, R), M["pearl_satin"], parent, axis="X", verts=72,
           bevel=0.01, seg=3)
    v2.cyl(f"hubcap_{tag}", R * 0.36, 0.03, (face + side * 0.004, y, R), M["hubcap"], parent, axis="X", verts=64,
           bevel=0.012, seg=4)
    v2.cyl(f"hub_boss_{tag}", R * 0.2, 0.02, (face + side * 0.018, y, R), M["gunmetal"], parent, axis="X", verts=48,
           bevel=0.005, seg=3)
    for k in range(8):
        a = 2 * math.pi * k / 8
        v2.cyl(f"lug_{tag}_{k}", 0.011, 0.012, (face + side * 0.026, y + R * 0.14 * math.sin(a), R + R * 0.14 * math.cos(a)),
               M["bolt_black"], parent, axis="X", verts=12, bevel=0.003, seg=2)


# ---------------------------------------------------------------------------
# Truck
# ---------------------------------------------------------------------------
def truck(name="Truck"):
    M = mats()
    v2.SC = bpy.context.scene.collection
    root = bpy.data.objects.new(name, None)
    v2.SC.objects.link(root)
    HW = 1.24                     # body half-width
    CY0, CY1 = 3.62, 5.62         # cab rear / front
    FW = (4.3, 0.52)              # front wheel center y, radius
    RW = ((-2.3, 0.52), (-3.5, 0.52))

    # --- chassis: frame rails, e-axles, battery packs behind pearl skirts ---
    v2.rbox("frame", -0.46, 0.46, -4.45, CY1 - 0.3, 0.72, 0.95, M["trim"], root, bevel=0.03)
    for sx in (-1, 1):
        sk = block(f"skirt_{sx}", *sorted((sx * 0.5, sx * HW)), -1.62, 3.4, 0.46, 1.08, 0.1, top=0.05, bot=0.04)
        v2.fin(sk, M["deck"], root, bevel=0.004, seg=2)
        v2.fin(block(f"skirt_plinth_{sx}", *sorted((sx * 0.52, sx * (HW + 0.012))), -1.64, 3.42, 0.44, 0.62, 0.1,
                     top=0.02, bot=0.03), M["cladding"], root)
        # charge port (left side): copper = energy
        if sx < 0:
            v2.fin(v2.extrude_x("charge_door", v2.rrect(2.6, 0.86, 0.13, 0.11, 0.03), -HW - 0.004, -HW + 0.01),
                   M["deck"], root, bevel=0.003, seg=2)
            v2.cyl("charge_ring", 0.035, 0.006, (-HW - 0.006, 2.6, 0.86), M["copper"], root, axis="X", verts=48)
        v2.logo_decal(f"mark_skirt_{sx}", M, root,
                      lambda lx, ly, sx=sx: ((sx * (HW + 0.0006), sx * lx + 0.9, 0.86 + ly), (-sx, 0, 0)), MARK)

    # --- cab: pearl, radiused, raked face; a black plinth wraps bumper and front arches ---
    cab = block("cab", -HW, HW, CY0, CY1, 0.95, 3.12, 0.22, top=0.16, rake=0.34, taper=0.05)
    pl = block("cab_plinth", -HW - 0.015, HW + 0.015, CY0 - 0.02, CY1 + 0.06, 0.5, 0.98, 0.24, bot=0.06)
    for sx in (-1, 1):
        for o in (cab, pl):
            v2.cut_with(o, v2.extrude_x("_arch", sarch(FW[0], FW[1], 0.66, 0.66, -0.5), *sorted((sx * 0.6, sx * 2))))
    # glasshouse: one dark band wrapping the cab (the truck's "mask"), windshield and side glass together
    glass = block("glass_band", -HW - 0.008, HW + 0.008, CY0 + 0.1, CY1 + 0.008, 0.95, 3.12, 0.23, top=0.16,
                  rake=0.34, taper=0.05)
    keep = v2.raw("_slab", *v2._box_data((3, 3, 0.8), (0, 4.8, 2.43)))
    m = glass.modifiers.new("slab", "BOOLEAN")
    m.operation, m.solver, m.object = "INTERSECT", "EXACT", keep
    v2.apply_mods(glass)
    bpy.data.objects.remove(keep)
    # door shut lines + recessed pull
    for sx in (-1, 1):
        for y in (3.78, 4.98):
            v2.cut(cab, (0.03, 0.006, 1.9), (sx * HW, y, 1.95))
        v2.cut(cab, (0.03, 0.14, 0.04), (sx * HW, 4.05, 1.75))
    def face_y(z):
        return CY1 - rake_at(0.34, (z - 0.95) / (3.12 - 0.95))

    # front face mask: headlamps + light ring, same construction as the robot's
    fy = face_y(1.3)
    v2.cut_with(cab, v2.extrude_y("_mask", v2.rrect(0, 1.3, 1.0, 0.14, 0.07), fy - 0.03, 7))
    v2.fin(cab, M["deck"], root, bevel=0.006, seg=3)
    v2.fin(pl, M["cladding"], root, bevel=0.01, seg=3)
    v2.fin(glass, M["visor"], root, bevel=0.004, seg=2)
    v2.fin(v2.extrude_y("mask_truck", v2.rrect(0, 1.3, 0.99, 0.13, 0.065), fy - 0.045, fy - 0.022), M["visor"], root,
           bevel=0.004, seg=2)
    light_ring("led_truck", 0, 1.3, 0.97, 0.11, 0.045, fy - 0.022, 1, M["headlamp"], root, w=0.012)
    for sx in (-1, 1):
        for k, px in enumerate((0.62, 0.73, 0.84)):
            v2.cyl(f"truck_projector_{sx}_{k}", 0.042, 0.02, (sx * px, fy - 0.012, 1.29), M["alu_dark"], root,
                   axis="Y", verts=40, bevel=0.004)
            v2.cyl(f"truck_lens_{sx}_{k}", 0.031, 0.016, (sx * px, fy - 0.004, 1.29), M["lens"], root, axis="Y",
                   verts=40)
    v2.logo_decal("mark_cab_front", M, root,
                  lambda lx, ly: ((lx, face_y(1.73 + ly) + 0.0006, 1.73 + ly), (0, -1, 0)), MARK)
    for sx in (-1, 1):
        lip(f"arch_front_{sx}", sarch(FW[0], FW[1], 0.66, 0.66, 0.5), HW + 0.015, sx, M, root)
        v2.fin(v2.extrude_x(f"liner_front_{sx}", sarch(FW[0], FW[1], 0.66, 0.66, 0.5, -0.002) +
                            sarch(FW[0], FW[1], 0.66, 0.66, 0.5, -0.02)[::-1], *sorted((sx * 0.6, sx * HW))),
               M["trim"], root)
        # camera mirrors (stalk + pod), flush tow cover, step behind the arch
        v2.rbox(f"mirror_stalk_{sx}", *sorted((sx * (HW - 0.02), sx * (HW + 0.2))), CY1 - 0.5, CY1 - 0.44, 2.42, 2.46,
                M["cladding"], root, bevel=0.012)
        v2.fin(block(f"mirror_pod_{sx}", *sorted((sx * (HW + 0.16), sx * (HW + 0.26))), CY1 - 0.56, CY1 - 0.38,
                     2.3, 2.55, 0.04, top=0.03, bot=0.03), M["cladding"], root)
        v2.fin(v2.extrude_y(f"tow_cover_truck_{sx}", v2.rrect(sx * 0.8, 0.72, 0.06, 0.035, 0.012), CY1 + 0.052,
                            CY1 + 0.061), M["cladding_satin"], root, bevel=0.002, seg=2)
        v2.fin(block(f"step_{sx}", *sorted((sx * 0.95, sx * (HW + 0.02))), 3.42, CY0 - 0.02, 0.62, 0.7, 0.03,
                     top=0.01), M["deck_grip"], root)
    # roof: slim work-light bar + comms fin
    v2.fin(v2.extrude_y("roof_led", v2.rrect(0, 3.15, 0.55, 0.018, 0.012), CY1 - 0.5, CY1 - 0.46), M["headlamp"], root)
    v2.fin(block("comms_fin", -0.04, 0.04, CY0 + 0.25, CY0 + 0.55, 3.1, 3.24, 0.03, top=0.03, rake=0.12),
           M["cladding"], root)

    # --- bed: two robot lanes, guide rails at the robot's track, flush tie-downs, pearl headboard ---
    v2.fin(block("bed", -HW - 0.02, HW + 0.02, -4.5, CY0 - 0.06, 1.12, 1.28, 0.06, top=0.015), M["deck_grip"], root)
    for x in (-1.2, 0.0, 1.2):  # lane guides (between and outside the two lanes)
        v2.fin(block(f"lane_rail_{x:+.1f}", x - 0.03, x + 0.03, -4.4, CY0 - 0.35, 1.26, 1.33, 0.02, top=0.015),
               M["gunmetal"], root)
    for sx in (-1, 1):
        v2.rbox(f"l_track_{sx}", *sorted((sx * (HW - 0.04), sx * (HW + 0.02))), -4.45, CY0 - 0.12, 1.24, 1.285,
                M["gunmetal"], root, bevel=0.005)
        for y in np.linspace(-4.1, 2.9, 6):
            v2.fin(v2.prism_z(f"tiedown_{sx}_{y:+.1f}", v2.rrect(sx * (HW - 0.12), y, 0.045, 0.025, 0.012), 1.27,
                              1.284), M["cavity"], root)
    hb = block("headboard", -HW + 0.04, HW - 0.04, CY0 - 0.3, CY0 - 0.08, 1.26, 2.62, 0.08, top=0.08)
    v2.fin(hb, M["deck"], root, bevel=0.003, seg=2)
    light_ring("headboard_led", 0, 2.35, 1.0, 0.12, 0.05, CY0 - 0.302, -1, M["led_front"], root, sides=False,
               w=0.014)
    v2.logo_decal("mark_headboard", M, root, lambda lx, ly: ((-lx, CY0 - 0.3006, 1.85 + ly), (0, 1, 0)), MARK)

    # --- rear: tandem duals under one molded fender, tail brackets, underride bar with a step ---
    for sx in (-1, 1):
        v2.fin(block(f"rear_fender_{sx}", *sorted((sx * 0.6, sx * (HW + 0.03))), -4.18, -1.62, 1.06, 1.12, 0.12,
                     top=0.03), M["cladding"], root)
        v2.fin(block(f"mudflap_{sx}", *sorted((sx * 0.7, sx * 1.18)), -4.22, -4.19, 0.28, 1.06, 0.03),
               M["rubber"], root)
        # rear corner posts carry vertical tail brackets (the robot's rear lamp language)
        v2.fin(block(f"corner_post_{sx}", *sorted((sx * 1.08, sx * (HW + 0.02))), -4.5, -4.3, 1.27, 1.78, 0.04,
                     top=0.04), M["deck"], root, bevel=0.003, seg=2)
        v2.fin(v2.extrude_y(f"tail_{sx}", v2.rrect(sx * 1.17, 1.52, 0.035, 0.2, 0.025), -4.506, -4.49),
               M["cavity"], root)
        v2.rbox(f"tail_bar_{sx}", sx * 1.17 - 0.012, sx * 1.17 + 0.012, -4.512, -4.504, 1.35, 1.7, M["tail"], root,
                bevel=0.003)
        for zz in (1.33, 1.705):
            v2.rbox(f"tail_ret_{sx}_{zz}", *sorted((sx * 1.145, sx * 1.195)), -4.512, -4.504, zz, zz + 0.012,
                    M["tail"], root, bevel=0.003)
    v2.fin(block("underride", -1.1, 1.1, -4.56, -4.4, 0.45, 0.63, 0.05, top=0.02, bot=0.02), M["cladding"], root)
    v2.fin(block("rear_step", -0.35, 0.35, -4.6, -4.42, 0.61, 0.64, 0.02), M["deck_grip"], root)

    # --- wheels ---
    for sx in (-1, 1):
        hub_wheel(f"F{sx}", sx * 1.0, FW[0], FW[1], 0.34, M, root)
        for i, (y, R) in enumerate(RW):
            hub_wheel(f"R{i}{sx}", sx * 0.93, y, R, 0.3, M, root, duals=True)
    return root


# ---------------------------------------------------------------------------
# Wash & inspect gate
# ---------------------------------------------------------------------------
def portal(name="Portal", width=1.8, height=1.52):
    """Wash & inspect gate. Units roll through with the panel stowed flat (mast down, top of glass ≈1.17 m):
    a mist bar wets the glass, a floating brush roller cleans it, an air knife dries it; a camera tunnel images the
    cells, and checkerboard targets on the post faces verify each unit's cameras and LiDAR. Water drains through the
    drive-over grate into recirculating tanks in the feet; the PV strip on the hood powers it."""
    M = mats()
    v2.SC = bpy.context.scene.collection
    root = bpy.data.objects.new(name, None)
    v2.SC.objects.link(root)
    hw, D, PW = width / 2, 0.62, 0.26           # opening half-width, depth (Y), post width
    top = height + 0.36                          # hood: height .. top
    for sx in (-1, 1):
        post = block(f"post_{sx}", *sorted((sx * hw, sx * (hw + PW - 0.01))), -D / 2 + 0.006, D / 2 - 0.006, 0.16,
                     height + 0.1, 0.06)
        v2.fin(post, M["deck"], root, bevel=0.004, seg=2)
        # tank foot (plinth language): recirculating water tank + pump, fill cap, anchor bolts
        v2.fin(block(f"foot_{sx}", *sorted((sx * (hw - 0.06), sx * (hw + PW + 0.14))), -0.55, 0.55, 0.0, 0.18, 0.08,
                     top=0.04), M["cladding"], root)
        v2.cyl(f"fill_cap_{sx}", 0.035, 0.02, (sx * (hw + PW + 0.06), 0.36, 0.19), M["gunmetal"], root, verts=32,
               bevel=0.004)
        for bx in (hw - 0.02, hw + PW + 0.08):
            for by in (-0.45, 0.45):
                v2.cyl(f"anchor_{sx}_{bx:.2f}_{by}", 0.016, 0.012, (sx * bx, by, 0.185), M["bolt_black"], root,
                       verts=6, bevel=0.003, seg=2)
        # calibration target on the inner face: a checkerboard the unit's cameras / LiDAR check themselves against
        x_in = sx * (hw + 0.0006)
        for i in range(6):
            for j in range(4):
                if (i + j) % 2:
                    continue
                y0, z0 = -0.18 + i * 0.06, 0.42 + j * 0.06
                v2.fin(v2.extrude_x(f"target_{sx}_{i}{j}", [(y0, z0), (y0 + 0.06, z0), (y0 + 0.06, z0 + 0.06),
                                                             (y0, z0 + 0.06)], *sorted((x_in, x_in - sx * 0.001))),
                       M["logo_ink"], root, smooth=False)
        # the mark on the post's tall outer face (the hood is too shallow to give it room)
        x_out = sx * (hw + PW - 0.01)
        v2.logo_decal(f"mark_post_{sx}", M, root,
                      lambda lx, ly, sx=sx, x_out=x_out: ((x_out + sx * 0.0006, sx * lx, 1.0 + ly), (-sx, 0, 0)), MARK)
        v2.cyl(f"post_cam_{sx}", 0.02, 0.01, (sx * (hw - 0.002), 0.0, 0.95), M["alu_dark"], root, axis="X", verts=32)
        v2.cyl(f"post_cam_lens_{sx}", 0.012, 0.01, (sx * (hw - 0.006), 0.0, 0.95), M["lens"], root, axis="X",
               verts=32)
    hood = block("hood", -hw - PW, hw + PW, -D / 2, D / 2, height, top, 0.08, top=0.06)
    v2.fin(hood, M["deck"], root, bevel=0.004, seg=2)
    # dark band framing the opening on both faces with the concentric light ring (the robot's mask ring)
    bh_top, b0 = height + 0.08, 0.22
    for s_ in (1, -1):
        band = v2.extrude_y(f"portal_band_{s_}", v2.rrect(0, (b0 + bh_top) / 2, hw + 0.08, (bh_top - b0) / 2, 0.12),
                            *sorted((s_ * (D / 2 - 0.01), s_ * (D / 2 + 0.003))))
        v2.cut_with(band, v2.extrude_y("_open", v2.rrect(0, (height - 0.6) / 2, hw, (height + 0.6) / 2, 0.06), -1, 1))
        v2.fin(band, M["visor"], root, bevel=0.002, seg=2)
        lh = (height + 0.04 - (b0 + 0.03)) / 2
        light_ring(f"LED_ring_{s_}", 0, b0 + 0.03 + lh, hw + 0.04, lh, 0.09, s_ * (D / 2 + 0.003), s_,
                   M["portal_led"], root, w=0.018)

    # under the hood, in travel order (units enter from -Y, the DeployScene direction): mist bar, floating brush
    # roller, camera tunnel, air knife
    zr = 1.27  # brush axis: bristles reach the stowed glass at ≈1.17 m; the arms float to follow it
    v2.cyl("mist_bar", 0.018, 2 * hw - 0.08, (0, -0.2, height - 0.04), M["gunmetal"], root, axis="X", verts=24,
           bevel=0.004)
    for k in range(9):
        v2.cyl(f"mist_nozzle_{k}", 0.008, 0.03, (-hw + 0.12 + k * (2 * hw - 0.24) / 8, -0.2, height - 0.07),
               M["cavity"], root, verts=12)
    v2.cyl("brush_roller", 0.1, 2 * hw - 0.1, (0, 0.0, zr), M["brush"], root, axis="X", verts=48, bevel=0.02, seg=3)
    v2.cyl("brush_core", 0.03, 2 * hw - 0.02, (0, 0.0, zr), M["gunmetal"], root, axis="X", verts=24)
    for sx in (-1, 1):
        v2.rbox(f"brush_arm_{sx}", *sorted((sx * (hw - 0.03), sx * (hw - 0.01))), -0.035, 0.035, zr - 0.02,
                height + 0.02, M["gunmetal"], root, bevel=0.006)
    v2.fin(v2.prism_z("air_knife", v2.rrect(0, 0.2, hw - 0.04, 0.03, 0.02), height - 0.08, height), M["gunmetal"],
           root, bevel=0.003, seg=2)
    v2.rbox("air_knife_slot", -hw + 0.06, hw - 0.06, 0.193, 0.207, height - 0.082, height - 0.078, M["cavity"], root)
    # camera tunnel under the hood (cell imaging + ID) between brush and air knife
    for k, x in enumerate((-0.45, -0.15, 0.15, 0.45)):
        v2.cyl(f"hood_cam_{k}", 0.024, 0.01, (x, 0.11, height - 0.006), M["alu_dark"], root, verts=32, bevel=0.003)
        v2.cyl(f"hood_lens_{k}", 0.015, 0.008, (x, 0.11, height - 0.01), M["lens"], root, verts=32)
    # drive-over drain grate, with ramped lips, feeding the tanks
    v2.fin(block("grate_frame", -hw - 0.05, hw + 0.05, -0.95, 0.95, 0.0, 0.035, 0.05, top=0.012), M["cladding"],
           root)
    for k in range(17):
        y = -0.8 + k * 0.1
        v2.rbox(f"grate_bar_{k}", -hw + 0.02, hw - 0.02, y - 0.012, y + 0.012, 0.03, 0.037, M["gunmetal"], root)
    # self-powered: PV strip on the hood
    v2.fin(v2.prism_z("portal_pv", v2.rrect(0, 0, hw + PW - 0.1, D / 2 - 0.07, 0.03), top - 0.004, top + 0.006),
           M["pv"], root, smooth=False)
    return root


# ---------------------------------------------------------------------------
# Battery swap station
# ---------------------------------------------------------------------------
SWAP_L, SWAP_W, SWAP_H = 6.06, 2.44, 1.1   # half-height 20-ft module; lane runs along Y
SWAP_PORTS = (1.35, -1.35)                 # y of the two swap ports
RAMP_L = 5.0                               # 12.4° ramps (robot slope rating ±15°)


def swap_station(name="SwapStation", door_open=True):
    """Battery swap station: a half-height 20-ft module a truck drops on site. Units climb a ramp onto the deck lane,
    stop over a port, a lift rises under the belly — two cones find the alignment sockets, the latches release — and
    the cassette drops into a charging rack inside; a charged one goes back up and the unit drives off the far ramp.
    The rack is the site battery: an inverter + grid tie at the end wall feed the site / grid. Energy moves by
    cassette, not by cable across the field."""
    M = mats()
    v2.SC = bpy.context.scene.collection
    root = bpy.data.objects.new(name, None)
    v2.SC.objects.link(root)
    hx, hy, H = SWAP_W / 2, SWAP_L / 2, SWAP_H
    # structure: black ISO frame (bottom rails, corner posts + castings) — twistlock-compatible for the truck
    v2.fin(block("frame_base", -hx, hx, -hy, hy, 0.0, 0.16, 0.04, top=0.01), M["cladding"], root)
    for sx in (-1, 1):
        for sy in (-1, 1):
            v2.rbox(f"corner_post_{sx}{sy}", *sorted((sx * hx, sx * (hx - 0.16))), *sorted((sy * hy, sy * (hy - 0.16))),
                    0.0, H, M["cladding"], root, bevel=0.015)
            for z in (0.02, H - 0.13):
                v2.rbox(f"casting_{sx}{sy}_{z:.2f}", *sorted((sx * (hx + 0.004), sx * (hx - 0.17))),
                        *sorted((sy * (hy + 0.004), sy * (hy - 0.17))), z, z + 0.11, M["gunmetal"], root, bevel=0.01)
                v2.fin(v2.extrude_x(f"casting_hole_{sx}{sy}_{z:.2f}", v2.rrect(sy * (hy - 0.085), z + 0.055, 0.03, 0.02,
                                                                              0.018),
                                    *sorted((sx * (hx + 0.005), sx * (hx + 0.002)))), M["cavity"], root)
    # pearl side walls with shallow corrugation (stiffness), louvers at the rack ends (thermal)
    for sx in (-1, 1):
        wall = block(f"wall_{sx}", *sorted((sx * (hx - 0.02), sx * (hx - 0.06))), -hy + 0.16, hy - 0.16, 0.16, H - 0.02,
                     0.01)
        if sx > 0 and door_open:  # service door opening (rack + lift visible)
            v2.cut_with(wall, v2.extrude_x("_door", v2.rrect(0.0, 0.62, 1.6, 0.4, 0.05), 0.5, 2))
        v2.fin(wall, M["deck"], root, bevel=0.003, seg=2)
        for k in range(26):
            y = -hy + 0.3 + k * 0.215
            if sx > 0 and door_open and abs(y) < 1.65:
                continue
            v2.fin(block(f"rib_{sx}_{k}", *sorted((sx * (hx - 0.02), sx * (hx + 0.005))), y - 0.05, y + 0.05, 0.2,
                         H - 0.08, 0.02), M["deck"], root)
        for sy in (-1, 1):
            for k in range(5):
                z = 0.32 + k * 0.1
                v2.rbox(f"louver_{sx}_{sy}_{k}", *sorted((sx * (hx + 0.004), sx * (hx + 0.012))),
                        *sorted((sy * 2.5, sy * 2.8)), z, z + 0.035, M["cavity"], root, bevel=0.004)
        v2.rbox(f"status_line_{sx}", *sorted((sx * (hx + 0.004), sx * (hx + 0.01))), -hy + 0.25, hy - 0.25, H - 0.07,
                H - 0.06, M["status"], root, bevel=0.002)
        # the mark on a smooth pearl label plate (the corrugated wall gives it no clean field)
        yl = -2.0 if sx > 0 else 2.0
        v2.fin(v2.extrude_x(f"label_plate_{sx}", v2.rrect(yl, 0.62, 0.2, 0.19, 0.03),
                            *sorted((sx * (hx - 0.01), sx * (hx + 0.014)))), M["deck"], root, bevel=0.003, seg=2)
        v2.logo_decal(f"mark_swap_{sx}", M, root,
                      lambda lx, ly, sx=sx, yl=yl: ((sx * (hx + 0.0146), sx * lx + yl, 0.62 + ly), (-sx, 0, 0)), MARK)
    if door_open:  # the side door, swung open on its hinges
        door = block("service_door", 0.0, 0.035, -1.6, 1.6, 0.22, 1.02, 0.03)
        v2.fin(door, M["deck"], root, bevel=0.003, seg=2)
        door.location = (hx + 0.02, 1.6, 0)
        door.rotation_euler[2] = math.radians(-100)
    # end walls; the rear one carries the inverter + grid tie (copper gland = energy leaves here)
    for s in (1, -1):
        v2.fin(block(f"end_wall_{s}", -hx + 0.06, hx - 0.06, *sorted((s * (hy - 0.02), s * (hy - 0.06))), 0.16,
                     H - 0.02, 0.01), M["deck"], root)
    v2.fin(v2.extrude_y("inverter_panel", v2.rrect(0.5, 0.62, 0.36, 0.3, 0.03), -hy - 0.004, -hy + 0.03),
           M["visor"], root, bevel=0.003, seg=2)
    for k in range(6):
        v2.rbox(f"inv_louver_{k}", 0.2, 0.8, -hy - 0.008, -hy - 0.002, 0.42 + k * 0.07, 0.445 + k * 0.07,
                M["cavity"], root)
    v2.cyl("grid_gland", 0.05, 0.05, (-0.55, -hy - 0.02, 0.42), M["copper"], root, axis="Y", verts=32, bevel=0.006)
    v2.cyl("grid_cable", 0.028, 0.6, (-0.55, -hy - 0.3, 0.42), M["rubber"], root, axis="Y", verts=16)
    # deck: grip surface, lane curbs at the robot's track, guide strips for the belly runners, two swap ports
    deck = block("deck", -hx, hx, -hy, hy, H - 0.02, H + 0.03, 0.04, top=0.008)
    for yp in SWAP_PORTS:
        v2.cut_with(deck, v2.prism_z("_port", v2.rrect(0, yp, 0.2, 0.34, 0.035), H - 0.1, H + 0.1))
    v2.fin(deck, M["deck_grip"], root)
    for sx in (-1, 1):
        v2.fin(block(f"curb_{sx}", *sorted((sx * 0.62, sx * 0.7)), -hy, hy, H + 0.03, H + 0.08, 0.02, top=0.015),
               M["cladding"], root)
        v2.rbox(f"runner_guide_{sx}", *sorted((sx * 0.205, sx * 0.225)), -hy + 0.1, hy - 0.1, H + 0.03, H + 0.045,
                M["gunmetal"], root, bevel=0.004)
    for i, yp in enumerate(SWAP_PORTS):
        # lift head under the port: two alignment cones + the blind-mate connector (copper) + latch drivers
        v2.fin(v2.prism_z(f"lift_head_{i}", v2.rrect(0, yp, 0.185, 0.325, 0.03), H - 0.06, H + 0.012), M["gunmetal"],
               root, bevel=0.004, seg=2)
        for sx in (-1, 1):
            bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.016, radius2=0.004, depth=0.03,
                                            location=(sx * 0.1, yp, H + 0.027))
            v2.fin(bpy.context.active_object, M["alu"], root, name=f"align_cone_{i}_{sx}")
        v2.rbox(f"lift_contact_{i}", -0.05, 0.05, yp + 0.155, yp + 0.185, H + 0.012, H + 0.02, M["copper"], root,
                bevel=0.002)
        # port rim light (concentric), tells the unit where to stop
        path = []
        for t in np.linspace(0, 2 * math.pi, 64, endpoint=False):
            c, s_ = math.cos(t), math.sin(t)
            px = 0.225 * math.copysign(abs(c) ** 0.4, c)
            py = yp + 0.365 * math.copysign(abs(s_) ** 0.4, s_)
            path.append((Vector((px, py, H + 0.031)), Vector((c, s_, 0)).normalized(), Vector((0, 0, 1))))
        path.append(path[0])
        v2.fin(v2.sweep(f"port_led_{i}", path, [(-0.004, 0.0), (0.004, 0.0), (0.004, 0.002), (-0.004, 0.002)]),
               M["portal_led"], root)
        # lift column (scissor) under the head, inside the module
        v2.rbox(f"lift_column_{i}", -0.06, 0.06, yp - 0.06, yp + 0.06, 0.16, H - 0.06, M["gunmetal"], root,
                bevel=0.01)
    # charging rack inside: two tiers of cassettes (same cassette as the robot's) with copper bus rails
    for tier, z in enumerate((0.22, 0.6)):
        v2.rbox(f"rack_shelf_{tier}", -hx + 0.1, hx - 0.1, -1.95, 1.95, z - 0.02, z, M["alu_dark"], root, bevel=0.005)
        v2.rbox(f"rack_bus_{tier}", -0.02, 0.02, -1.95, 1.95, z + 0.2, z + 0.23, M["copper"], root, bevel=0.004)
        for k in range(8):
            y = -1.7 + k * 0.49
            if any(abs(y - p) < 0.3 for p in SWAP_PORTS) and tier == 1:
                continue  # lift columns pass through here
            for sx in (-1, 1):
                x = sx * 0.62
                v2.fin(v2.prism_z(f"rack_cassette_{tier}_{k}_{sx}", v2.rrect(x, y, 0.3, 0.15, 0.028), z, z + 0.19),
                       M["alu_dark"], root, bevel=0.003, seg=2)
                v2.rbox(f"rack_led_{tier}_{k}_{sx}", x - 0.05, x + 0.05, y - 0.151, y - 0.147, z + 0.15, z + 0.16,
                        M["status"], root)
    # ramps both ends (fold onto the deck for transport): grip, gunmetal side curbs, hinge knuckles, feet
    slope = math.atan2(H + 0.03, RAMP_L)
    for s in (1, -1):
        rp = block(f"ramp_{s}", -0.7, 0.7, 0.0, RAMP_L, -0.03, 0.0, 0.02)
        v2.fin(rp, M["deck_grip"], root)
        for sx in (-1, 1):
            v2.rbox(f"ramp_curb_{s}_{sx}", *sorted((sx * 0.62, sx * 0.7)), 0.0, RAMP_L, 0.0, 0.05, M["gunmetal"], rp,
                    bevel=0.008)
            v2.cyl(f"hinge_{s}_{sx}", 0.03, 0.12, (sx * 0.5, 0.0, -0.01), M["gunmetal"], rp, axis="X", verts=24)
        rp.location = (0, s * hy, H + 0.03)
        rp.rotation_euler = (-slope, 0, 0 if s > 0 else math.pi)
    return root


if __name__ == "__main__":
    for nm, make in (("truck", truck), ("portal", portal), ("swap_station", lambda: swap_station(door_open=False))):
        br.clear_scene()
        r = make()
        r.name = nm
        import export_v2
        export_v2.web_materials()  # no anisotropy / transmission in realtime (see export_v2.web_materials)
        # web: apply modifiers, cap triangles per part, merge per material (one draw call each; the portal's
        # LED_* material stays separate so DeployScene can animate it)
        meshes = [o for o in r.children_recursive if o.type == "MESH"]
        for o in meshes:
            if o.modifiers:
                v2.apply_mods(o)
            t = sum(len(p.vertices) - 2 for p in o.data.polygons)
            cap = 6000 if o.name.startswith(("cab", "glass_band", "tire_", "beam", "post_")) else 2500
            if t > cap:
                d = o.modifiers.new("dec", "DECIMATE")
                d.ratio = max(cap / t, 0.1)
                v2.apply_mods(o)
        groups = {}
        for o in meshes:
            groups.setdefault(o.data.materials[0].name, []).append(o)
        for mat, objs in groups.items():
            if len(objs) > 1:
                bpy.ops.object.select_all(action="DESELECT")
                for o in objs:
                    o.select_set(True)
                bpy.context.view_layer.objects.active = objs[0]
                bpy.ops.object.join()
            objs[0].name = f"{nm}__{mat}"
        for o in [o for o in r.children_recursive if o.type == "MESH"]:  # budget per draw call
            t = sum(len(p.vertices) - 2 for p in o.data.polygons)
            cap = 14000 if ("Deck_Pearl" in o.name or "Cladding" in o.name or "Rubber" in o.name) else 5000
            if t > cap:
                d = o.modifiers.new("dec", "DECIMATE")
                d.ratio = max(cap / t, 0.1)
                v2.apply_mods(o)
        br.export_glb(os.path.join(br.ROOT, "public", "models", f"{nm}.glb"), r)
        ms = [o for o in r.children_recursive if o.type == "MESH"]
        tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in ms)
        print("EXPORTED", nm, f"{len(ms)} meshes, {tris} tris,",
              f"{os.path.getsize(os.path.join(br.ROOT, 'public', 'models', nm + '.glb')) / 1e6:.2f} MB")
