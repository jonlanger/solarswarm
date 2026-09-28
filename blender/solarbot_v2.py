"""SolarSwarm robot, v2 industrial design (preview).

  Blender -b -P blender/solarbot_v2.py -- [--out DIR]

Design language (see blender/DESIGN_RESEARCH.md for the GX / Land Cruiser analysis)
  - Surfaced, not faceted: the pearl shell and black plinth are dense analytic meshes — a
    rounded-rectangle plan swept through a section with slight tumblehome, a radiused shoulder and a
    gently crowned platform; flanks and fascias carry a small crown.
  - Plinth + body (Land Cruiser): one black molded plinth wraps bumpers, rockers and belly, with a
    rolled rub rib at the widest line; rolled arch flares grow out of it around rounded-square
    arches concentric with the wheels, with liners and axle boots inside.
  - Fender blisters (GX): the pearl shell swells over each wheel and pulls into a waist between.
  - Face mask: one inset dark panel carries LiDAR, cameras and three-projector lamps; the light line
    tops it, drops down its ends (the GX "L") and wraps the corner radius onto the flanks. At the rear
    a full-width bar joins vertical corner lamps.
  - Hardware on pads: recovery points, hitch and dock contacts sit flush in the plinth; skid plates
    under the approach angles; belly runners take pallet forks and guide the unit along the swap deck;
    roof rails are crew grab handles with lift slots in their ramped feet.
  - Battery cassette: the 5 kWh pack drops out of the belly at the swap station (latch pins, alignment
    sockets, blind-mate copper connector, finger pull); the top hatch is the service bay (compute, fuses).
  - Water-drop motif: concentric ripple back shell on the panel radiating from the mount hub, echoed
    in the wheel faces.
  - Real part lines: every seam is a physical split between separately modeled parts, so the same
    model drives the exploded view.

Rig contract (unchanged from build_robot.py — see components/three/Robot.tsx):
  SolarBot, wheel_FL/FR/RL/RR, mast_height, panel_azimuth, panel_tilt, led_front, led_rear,
  status_ring and the LED_* materials.

Every object may carry an "ex" custom property: its exploded-view offset in parent space.
Objects tagged "internal" are hidden in the assembled product (only needed for the exploded view).
"""

import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_robot as br  # noqa: E402
from build_robot import srgb, _principled  # noqa: E402

# ---------------------------------------------------------------------------
# Dimensions (meters). Blender: X = right, Y = forward, Z = up.
# ---------------------------------------------------------------------------
# Body surfaces are analytic (see DESIGN_RESEARCH.md): a rounded-rectangle plan swept through a section
# profile, with crowned flanks and fascias, fender blisters over the wheels and a black plinth below.
W0, L0, R0 = 0.445, 0.665, 0.09     # base plan: half-width, half-length, corner radius
BELT_Z = 0.264                       # pearl shell / black plinth split
SHOULDER_Z, DECK_Z = 0.424, 0.427    # shoulder radius ends / crowned platform center
PLINTH_Z0 = 0.12                     # belly
CROWN_SIDE, CROWN_FACE = 0.006, 0.006
BLISTER, BLISTER_HALF = 0.018, 0.26  # fender blister height and half-length along Y
BUMPER = 0.035                       # plinth bumper standout (front and rear)
# rounded-square wheel arches, concentric with the hub
ARCH_A, ARCH_H, ARCH_N = 0.20, 0.22, 3.0
WELL_X = 0.335                       # inner wall of the wheel wells
BEAM_Y, BEAM_Z, BEAM_R = 0.42, 0.17, 0.068
WHEEL_X, WHEEL_R, WHEEL_W, RIM_R = 0.40, 0.17, 0.10, 0.118
MAST_OUTER_TOP = 0.86
AZ_Z = 1.08
TILT_Z = 1.22
PANEL_W, PANEL_L = 1.0, 1.65
PZ_BACK = 0.11          # panel laminate underside, relative to the tilt axis
HUB_R = 0.13
DZ_INT = 0.09           # internal packaging height offset
CAS_HW, CAS_HL = 0.15, 0.30   # battery cassette half-width / half-length (drops out of the belly)

NF, NA, NS = 12, 16, 24  # plan samples: half fascia, corner arc, half flank
# Mesh resolution. Renders use these defaults; export_v2.py lowers them for the web (hero / swarm LOD).
Q = dict(backshell_step=0.004, ripple=True, tire_n=8, knurl=True, rim_n=160, rim_prof=70)


def smoothstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def plan_ring(W, L, R):
    """Rounded rectangle, CCW from the front center, fixed sample count so rings loft cleanly.
    Returns [(x, y, nx, ny)] with the outward plan normal."""
    R = max(R, 0.004)
    a, b = W - R, L - R
    pts = []

    def line(p0, p1, n, k):
        for i in range(k):
            t = i / k
            pts.append((p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, *n))

    def arc(cx, cy, a0, k):
        for i in range(k):
            th = a0 + (math.pi / 2) * i / k
            pts.append((cx + R * math.cos(th), cy + R * math.sin(th), math.cos(th), math.sin(th)))

    line((0, L), (-a, L), (0, 1), NF)
    arc(-a, b, math.pi / 2, NA)
    line((-W, b), (-W, 0), (-1, 0), NS)
    line((-W, 0), (-W, -b), (-1, 0), NS)
    arc(-a, -b, math.pi, NA)
    line((-a, -L), (0, -L), (0, -1), NF)
    line((0, -L), (a, -L), (0, -1), NF)
    arc(a, -b, 1.5 * math.pi, NA)
    line((W, -b), (W, 0), (1, 0), NS)
    line((W, 0), (W, b), (1, 0), NS)
    arc(a, b, 0.0, NA)
    line((a, L), (0, L), (0, 1), NF)
    return pts


def blister(y, z):
    """GX-style fender volume over each wheel, fading out below the shoulder and into a waist between."""
    g = 0.0
    for yc in (BEAM_Y, -BEAM_Y):
        u = (y - yc) / BLISTER_HALF
        if abs(u) < 1:
            g = max(g, math.cos(math.pi / 2 * u) ** 2)
    return BLISTER * g * (1 - smoothstep(0.36, 0.41, z))


# pearl shell section: (z, inset) — slight tumblehome, radiused shoulder, gently crowned platform
SHELL_PROFILE = [(BELT_Z, 0.0), (0.29, 0.0), (0.32, 0.001), (0.35, 0.003), (0.38, 0.005)]
SHELL_PROFILE += [(0.38 + (SHOULDER_Z - 0.38) * math.sin(p), 0.005 + 0.042 * (1 - math.cos(p)))
                  for p in np.linspace(0, math.pi / 2, 10)[1:]]
SHELL_PROFILE += [(SHOULDER_Z + (DECK_Z - SHOULDER_Z) * (1 - (1 - (d - 0.047) / 0.373) ** 2), d)
                  for d in (0.07, 0.11, 0.16, 0.22, 0.28, 0.34, 0.39, 0.42)]


def plinth_e(z, rib=True):
    """Black plinth plan offset vs the base plan: undercut belly, rolled rub rib, flush at the beltline."""
    e = 0.005 + (0.012 * math.exp(-((z - 0.215) / 0.014) ** 2) if rib else 0.0)
    if z < 0.17:
        e -= 0.085 * (1 - math.sin(math.pi / 2 * (z - PLINTH_Z0) / 0.05))
    return e - 0.005 * smoothstep(0.235, BELT_Z, z)


def bumper_p(z):
    return BUMPER * smoothstep(0.138, 0.16, z) * (1 - smoothstep(0.235, 0.252, z))


def surface_pt(p, z, part, W, L, R):
    """Displace a plan point (x, y, nx, ny) on ring (W, L, R) by crown, blister (shell) or bumper (plinth)."""
    x, y, nx, ny = p
    a, b = W - R, L - R
    extra = 0.0
    if abs(nx) > 0.999:  # flank
        extra += (CROWN_SIDE if part == "shell" else 0.003) * max(0.0, 1 - (y / b) ** 2)
    elif abs(ny) > 0.999 and part == "shell":  # fascia
        extra += CROWN_FACE * max(0.0, 1 - (x / a) ** 2)
    if part == "plinth" and abs(nx) < 0.999:
        # bumper runs the full fascia and around the corner radius, straight into the arch lip
        extra += bumper_p(z)
    if part == "shell":
        extra += blister(y, z) * nx * nx
    return (x + nx * extra, y + ny * extra, z)


def shell_inset(z):
    zs, ds = zip(*[(zz, d) for zz, d in SHELL_PROFILE if zz <= SHOULDER_Z])
    return float(np.interp(z, zs, ds))


def body_x(y, z, rib=True):
    """|x| of the body surface at (y, z) on a flank or corner (for parts that hug it)."""
    if z < BELT_Z:
        e, part = plinth_e(z, rib), ("plinth" if rib else "plinth_base")
        W, L, R = W0 + e, L0 + e, R0 + e
    else:
        d, part = shell_inset(z), "shell"
        W, L, R = W0 - d, L0 - d, max(R0 - d, 0.004)
    a, b = W - R, L - R
    ay = abs(y)
    if ay <= b:
        nx, x = 1.0, W
    else:
        dy = min(ay - b, R)
        x = a + math.sqrt(max(R * R - dy * dy, 0.0))
        nx = (x - a) / R
    return surface_pt((x, y if ay <= b else math.copysign(b + dy, y), nx, 0.0 if ay <= b else math.copysign(dy / R, y)),
                      z, part, W, L, R)[0]


def arch(yc, g=0.0, zb=0.14, n=40):
    """Rounded-square arch outline in YZ (rear leg -> over the top -> front leg), grown by g."""
    A, H = ARCH_A + g, ARCH_H + g
    pts = [(yc - A, zb)]
    for i in range(n + 1):
        th = math.pi * (1 - i / n)
        c, s = math.cos(th), math.sin(th)
        pts.append((yc + A * math.copysign(abs(c) ** (2 / ARCH_N), c), WHEEL_R + H * abs(s) ** (2 / ARCH_N)))
    pts.append((yc + A, zb))
    return pts


# ---------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------
def materials(tex_dir):
    M = {}
    M["body"] = _principled("Body_Graphite", srgb("#1a191f"), rough=0.42, coat=0.2, coat_rough=0.25)
    M["deck"] = _principled("Deck_Pearl", srgb("#dedbe2"), rough=0.32, coat=0.45, coat_rough=0.1)
    M["pearl_satin"] = _principled("Pearl_Satin", srgb("#d8d5dd"), rough=0.4, coat=0.25, coat_rough=0.18)
    M["cladding"] = _principled("Cladding_Textured", srgb("#1b1b20"), rough=0.72)
    _grain(M["cladding"])
    M["cladding_satin"] = _principled("Cladding_Satin", srgb("#1d1d22"), rough=0.45)
    M["sensor"] = _principled("Sensor_Face", srgb("#101013"), rough=0.3, coat=0.4, coat_rough=0.2)
    M["hubcap"] = _principled("Hubcap_Matte", srgb("#3b3b41"), rough=0.68)
    M["gunmetal"] = _principled("Gunmetal", srgb("#34353b"), metallic=1.0, rough=0.38)
    M["bolt_black"] = _principled("Bolt_Gloss_Black", srgb("#060607"), metallic=0.6, rough=0.12, coat=1.0,
                                  coat_rough=0.03)
    M["logo_ink"] = _principled("Logo_Ink", srgb("#1f1d27"), rough=0.55)
    M["logo_violet"] = _principled("Logo_Violet", srgb("#5b2bd9"), rough=0.5)
    M["trim"] = _principled("Trim_Black", srgb("#0e0e11"), rough=0.55)
    M["rubber"] = _principled("Tire_Rubber", srgb("#121214"), rough=0.82)
    M["alu"] = _principled("Aluminum_Brushed", srgb("#c9cbd1"), metallic=1.0, rough=0.26, **{"Anisotropic": 0.5})
    M["alu_dark"] = _principled("Aluminum_Anodized", srgb("#2f2e36"), metallic=1.0, rough=0.32)
    M["copper"] = _principled("Copper", (0.955, 0.52, 0.33), metallic=1.0, rough=0.24)
    M["steel"] = _principled("Fastener_Steel", srgb("#8d8f96"), metallic=1.0, rough=0.35)
    M["cavity"] = _principled("Cavity_Black", srgb("#050507"), rough=0.8)
    M["estop"] = _principled("EStop_Red", srgb("#c8322b"), rough=0.35, coat=0.6)
    M["visor"] = _principled(
        "Visor_Smoked", srgb("#040406"), rough=0.03, coat=1.0, coat_rough=0.0,
    )
    M["lens"] = _principled("Sensor_Glass", srgb("#07060c"), rough=0.02, coat=1.0, coat_rough=0.0,
                            **{"Specular IOR Level": 0.8})
    M["lidar_win"] = _principled("Lidar_Window", srgb("#2a1a3a"), metallic=0.4, rough=0.08, coat=1.0)
    M["glass"] = _principled("PV_Glass", (1, 1, 1), rough=0.02,
                             **{"Transmission Weight": 1.0, "IOR": 1.5, "Specular IOR Level": 0.25})
    M["led_front"] = _principled("LED_Front", srgb("#b99aff"), rough=0.3,
                                 **{"Emission Color": (*srgb("#9d6bff"), 1.0), "Emission Strength": 30.0})
    M["led_rear"] = _principled("LED_Rear", srgb("#f0b27a"), rough=0.3,
                                **{"Emission Color": (*srgb("#e0a36a"), 1.0), "Emission Strength": 20.0})
    M["status"] = _principled("LED_Status", srgb("#b99aff"), rough=0.3,
                              **{"Emission Color": (*srgb("#9d6bff"), 1.0), "Emission Strength": 5.0})
    # internals
    M["pcb"] = _principled("PCB", srgb("#16241f"), rough=0.4, coat=0.5)
    M["cell_wrap"] = _principled("Cell_Module", srgb("#3a3252"), rough=0.45)
    M["core"] = _principled("Stator_Core", srgb("#5a5c63"), metallic=1.0, rough=0.4)

    pv = bpy.data.materials.get("PV_Cells_v2")
    if not pv:
        path = os.path.join(tex_dir, "panel_cells_v2.png")
        if not os.path.exists(path):
            make_panel_albedo_v2(path)
        pv = _principled("PV_Cells_v2", (0.03, 0.02, 0.04), rough=0.35, **{"Specular IOR Level": 0.15})
        nt = pv.node_tree
        img = nt.nodes.new("ShaderNodeTexImage")
        img.image = bpy.data.images.load(path, check_existing=True)
        img.interpolation = "Cubic"
        nt.links.new(img.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
    M["pv"] = pv
    return M


def _grain(mat, scale=1400.0, strength=0.18):
    """Fine molded-in grain (bump only) for unpainted cladding."""
    nt = mat.node_tree
    if any(n.type == "BUMP" for n in nt.nodes):
        return
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = 3.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = 0.0004
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    nt.links.new(nz.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], nt.nodes["Principled BSDF"].inputs["Normal"])


def make_panel_albedo_v2(path, seed=11):
    """All-black back-contact module: plum→indigo, no busbars, barely-there cell gaps and a reference
    irradiance cell in one corner."""
    from textures import _save_png

    rng = np.random.default_rng(seed)
    ppm = 900
    W, H = int(PANEL_W * ppm), int(PANEL_L * ppm)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    u, v = xx / W, yy / H
    plum, indigo = np.array([0.31, 0.19, 0.29]), np.array([0.21, 0.175, 0.32])
    g = np.clip(0.55 * u + 0.45 * v, 0, 1)[..., None]
    img = plum * (1 - g) + indigo * g
    # soft crystalline mottling
    n = rng.normal(0, 1, (H // 40 + 2, W // 40 + 2))
    n = np.kron(n, np.ones((40, 40)))[:H, :W]
    k = np.ones(15) / 15
    n = np.apply_along_axis(lambda r: np.convolve(r, k, "same"), 1, n)
    n = np.apply_along_axis(lambda c: np.convolve(c, k, "same"), 0, n)
    img *= (1 + 0.05 * n / (np.abs(n).max() + 1e-6))[..., None]
    # 6 x 10 cells, 2 mm dark gaps, tiny per-cell variation
    m, gap = 0.02 * ppm, 0.002 * ppm
    cw, ch = (W - 2 * m - 5 * gap) / 6, (H - 2 * m - 9 * gap) / 10
    lx, ly = (xx - m) % (cw + gap), (yy - m) % (ch + gap)
    cx, cy = ((xx - m) // (cw + gap)).astype(int), ((yy - m) // (ch + gap)).astype(int)
    jit = rng.normal(0, 0.018, (12, 12))
    img *= (1 + jit[np.clip(cy, 0, 11), np.clip(cx, 0, 11)])[..., None]
    gaps = (lx > cw) | (ly > ch) | (xx < m) | (yy < m) | (xx > W - m) | (yy > H - m)
    img[gaps] *= 0.55
    # reference cell (top-left)
    rs, r0 = 0.075 * ppm, m + 0.012 * ppm
    ref = (xx > r0) & (xx < r0 + rs) & (yy > r0) & (yy < r0 + rs)
    edge = ref & ~((xx > r0 + 4) & (xx < r0 + rs - 4) & (yy > r0 + 4) & (yy < r0 + rs - 4))
    img[ref] = np.array([0.40, 0.32, 0.43])
    img[edge] = np.array([0.62, 0.62, 0.66])
    _save_png(path, np.clip(img, 0, 1))
    return path


# ---------------------------------------------------------------------------
# Mesh helpers
# ---------------------------------------------------------------------------
SC = None  # scene collection, set in build()


def raw(name, verts, faces):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    SC.objects.link(o)
    return o


def extrude_x(name, pts, x0, x1, taper_fn=None):
    """Closed YZ profile extruded across X (optionally narrowed along Y by taper_fn)."""
    n = len(pts)
    t = taper_fn or (lambda y: 1.0)
    verts = [(x0 * t(y), y, z) for y, z in pts] + [(x1 * t(y), y, z) for y, z in pts]
    faces = [list(range(n)), list(range(n, 2 * n))]
    faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    return raw(name, verts, faces)


def revolve_x(name, prof, center, n=96, rmod=None):
    """Closed (dx, r) profile revolved about an X-axis through center. rmod(theta, dx, r) -> r."""
    cx, cy, cz = center
    m = len(prof)
    verts = []
    for i in range(n):
        th = 2 * math.pi * i / n
        for dx, r in prof:
            rr = rmod(th, dx, r) if rmod else r
            verts.append((cx + dx, cy + rr * math.sin(th), cz + rr * math.cos(th)))
    faces = []
    for i in range(n):
        a, b = i * m, ((i + 1) % n) * m
        for j in range(m):
            k = (j + 1) % m
            faces.append((a + j, b + j, b + k, a + k))
    return raw(name, verts, faces)


def apply_mods(o):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    old = o.data
    o.modifiers.clear()
    o.data = me
    bpy.data.meshes.remove(old)


def cut(o, size, loc, rotz=0.0):
    """Boolean-subtract a box (pockets, recesses, slots), optionally yawed about its center."""
    v, f = _box_data(size, loc)
    if rotz:
        c, s = math.cos(rotz), math.sin(rotz)
        v = [(loc[0] + c * (x - loc[0]) - s * (y - loc[1]), loc[1] + s * (x - loc[0]) + c * (y - loc[1]), z)
             for x, y, z in v]
    cut_with(o, raw("_cutter", v, f))


def cut_with(o, cutter):
    m = o.modifiers.new("cut", "BOOLEAN")
    m.operation, m.object, m.solver = "DIFFERENCE", cutter, "EXACT"
    apply_mods(o)
    bpy.data.objects.remove(cutter)


def _box_data(size, loc):
    sx, sy, sz = (s / 2 for s in size)
    x, y, z = loc
    v = [(x + a * sx, y + b * sy, z + c * sz) for a in (-1, 1) for b in (-1, 1) for c in (-1, 1)]
    f = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    return v, f


def fin(o, mat, parent, bevel=None, seg=4, smooth=True, ex=None, internal=False, name=None):
    br._finish(o, mat, parent, SC, smooth=smooth, bevel=bevel, segments=seg, name=name)
    if bevel:
        o.modifiers["bevel"].use_clamp_overlap = True
    if ex:
        o["ex"] = list(ex)
    if internal:
        o["internal"] = True
    if mat.name in ("PV_Glass", "Visor_Smoked"):
        o.visible_shadow = False  # thin glazing: let light reach what's behind it (no caustics needed)
    return o


def box(name, size, loc, mat, parent, bevel=0.0, seg=4, **kw):
    o = raw(name, *_box_data(size, (0, 0, 0)))
    o.location = loc
    bpy.context.view_layer.update()
    return fin(o, mat, parent, bevel=bevel or None, seg=seg, name=name, **kw)


def cyl(name, r, depth, loc, mat, parent, axis="Z", verts=48, bevel=0.0, seg=3, **kw):
    o = br.cyl(name, r, depth, loc, mat, parent, SC, axis=axis, verts=verts, bevel=bevel, segments=seg)
    if bevel:
        o.modifiers["bevel"].use_clamp_overlap = True
    for k, v in kw.items():
        if k == "ex" and v:
            o["ex"] = list(v)
        if k == "internal" and v:
            o["internal"] = True
    return o


def rbox(name, x0, x1, y0, y1, z0, z1, mat, parent, bevel=0.0, **kw):
    return box(name, (x1 - x0, y1 - y0, z1 - z0), ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), mat, parent,
               bevel=bevel, **kw)


def screw(name, loc, axis, M, parent, r=0.0045, ex=None, mat=None):
    """Button-head hex screw, seated on a face whose normal is `axis` (e.g. '+X', '-Y', '+Z')."""
    ax, sgn = axis[1], (1 if axis[0] == "+" else -1)
    d = Vector((0, 0, 0))
    d["XYZ".index(ax)] = sgn
    head = cyl(name, r, 0.003, tuple(Vector(loc) + d * 0.0012), mat or M["steel"], parent, axis=ax, verts=20,
               bevel=0.0012, seg=2, ex=ex)
    hexo = cyl(name + "_hex", r * 0.45, 0.003, tuple(Vector(loc) + d * 0.0022), M["cavity"], parent, axis=ax,
               verts=6, ex=ex)
    return head, hexo


def ring(name, major, minor, loc, axis, mat, parent, ex=None):
    """Torus (tow / lift eye) whose axis runs along `axis`."""
    rot = {"X": (0, math.pi / 2, 0), "Y": (math.pi / 2, 0, 0), "Z": (0, 0, 0)}[axis]
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=48, minor_segments=12,
                                     location=loc, rotation=rot)
    o = bpy.context.active_object
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return fin(o, mat, parent, name=name, ex=ex)


def emp(name, loc, parent, ex=None):
    o = br.empty(name, loc, parent, SC)
    if ex:
        o["ex"] = list(ex)
    return o


# ---------------------------------------------------------------------------
# Chassis
# ---------------------------------------------------------------------------
def ring_loft(name, rings):
    """Closed solid through equal-count rings (bottom to top), capped at both ends."""
    n, m = len(rings[0]), len(rings)
    verts = [v for r in rings for v in r]
    faces = [list(range(n))[::-1], list(range((m - 1) * n, m * n))]
    for j in range(m - 1):
        a, b = j * n, (j + 1) * n
        faces += [(a + i, a + (i + 1) % n, b + (i + 1) % n, b + i) for i in range(n)]
    return raw(name, verts, faces)


def sweep(name, path, section, closed_section=True):
    """Sweep a 2D section along a path. path: [(origin, u_axis, v_axis)], section: [(su, sv)]; capped ends."""
    k = len(section)
    verts, faces = [], []
    for o, u, v in path:
        verts += [tuple(Vector(o) + Vector(u) * su + Vector(v) * sv) for su, sv in section]
    for j in range(len(path) - 1):
        a, b = j * k, (j + 1) * k
        for i in range(k if closed_section else k - 1):
            faces.append((a + i, a + (i + 1) % k, b + (i + 1) % k, b + i))
    faces += [list(range(k))[::-1], list(range((len(path) - 1) * k, len(path) * k))]
    return raw(name, verts, faces)


def rrect(cx, cz, hw, hh, r, k=6):
    """Rounded rectangle outline (in the plane of the two given axes), CCW."""
    pts = []
    for qx, qz, a0 in ((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)):
        for i in range(k + 1):
            t = math.radians(a0 + 90 * i / k)
            pts.append((cx + qx * (hw - r) + r * math.cos(t), cz + qz * (hh - r) + r * math.sin(t)))
    return pts


def extrude_y(name, pts, y0, y1):
    """Closed XZ outline extruded along Y."""
    n = len(pts)
    verts = [(x, y0, z) for x, z in pts] + [(x, y1, z) for x, z in pts]
    faces = [list(range(n)), list(range(n, 2 * n))]
    faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    return raw(name, verts, faces)


def shell_rings():
    rings = []
    for z, d in SHELL_PROFILE:
        W, L, R = W0 - d, L0 - d, max(R0 - d, 0.004)
        fade = 1 - smoothstep(0.40, SHOULDER_Z, z)  # crown dies out in the shoulder radius
        ring = []
        for p in plan_ring(W, L, R):
            q = surface_pt(p, z, "shell", W, L, R)
            ring.append((p[0] + (q[0] - p[0]) * fade, p[1] + (q[1] - p[1]) * fade, z))
        rings.append(ring)
    return rings


def plinth_rings():
    rings = []
    for z in np.linspace(PLINTH_Z0, BELT_Z - 0.004, 30):
        e = plinth_e(z)
        W, L, R = W0 + e, L0 + e, R0 + e
        rings.append([surface_pt(p, z, "plinth", W, L, R) for p in plan_ring(W, L, R)])
    return rings


def fascia_y(x, z, s):
    """Y of the pearl fascia (s=+1 front, -1 rear) at (x, z) — flat face with crown."""
    d = shell_inset(z)
    a = W0 - R0
    return s * (L0 - d + CROWN_FACE * max(0.0, 1 - (x / a) ** 2))


def prism_z(name, pts, z0, z1):
    """Closed XY outline extruded along Z."""
    n = len(pts)
    verts = [(x, y, z0) for x, y in pts] + [(x, y, z1) for x, y in pts]
    faces = [list(range(n)), list(range(n, 2 * n))]
    faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    return raw(name, verts, faces)


def top_z(x, y):
    """Height of the crowned platform at (x, y) (inside the shoulder)."""
    d = min(W0 - abs(x), L0 - abs(y))
    zs, ds = zip(*[(z, dd) for z, dd in SHELL_PROFILE if dd >= 0.047])
    return float(np.interp(d, ds, zs))


def plinth_y(z):
    """|y| of the plinth bumper face at height z (full width across the fascia)."""
    return L0 + plinth_e(z) + bumper_p(z)


def logo_decal(name, M, parent, place, width, ex=None):
    """The SolarSwarm mark (blender/logo.py) as a thin decal. place(lx, ly) -> (outer_point, inward_normal)."""
    import logo
    u = width / logo.EXTENT
    for i, (role, poly) in enumerate(logo.polygons()):
        outer, inner = [], []
        for lx, ly in poly:
            p, n = place(lx * u, ly * u)
            outer.append(tuple(Vector(p) - Vector(n) * 0.0004))
            inner.append(tuple(Vector(p) + Vector(n) * 0.0012))
        k = len(poly)
        faces = [list(range(k)), list(range(k, 2 * k))[::-1]]
        faces += [(j, (j + 1) % k, k + (j + 1) % k, k + j) for j in range(k)]
        o = raw(f"{name}_{i}", outer + inner, faces)
        fin(o, M["logo_violet"] if role == "panel" else M["logo_ink"], parent, smooth=False, ex=ex)


def build_chassis(root, M):
    UP = (0, 0, 0.5)  # pearl shell and everything mounted to it
    wells = [(sx, sy * BEAM_Y) for sy in (1, -1) for sx in (-1, 1)]

    def cut_arches(o):
        for sx, yc in wells:
            cut_with(o, extrude_x("_arch", arch(yc, 0.0, -0.2), *sorted((sx * WELL_X, sx * 1.0))))

    # --- black plinth: bumpers (wrapping the corners into the arch lips), rockers, rub rib, belly ---
    pl = ring_loft("plinth", plinth_rings())
    cut_arches(pl)
    ZT = 0.19  # recovery-point / hitch height: the plinth's structural spine
    for sx in (-1, 1):  # front recovery-point covers (screw-in eye stowed under the hatch)
        cut_with(pl, extrude_y("_rp", rrect(sx * 0.29, ZT, 0.026, 0.016, 0.006), plinth_y(ZT) - 0.005, 0.9))
    cut_with(pl, extrude_y("_hitch", rrect(0, ZT, 0.045, 0.038, 0.007), -0.9, -plinth_y(ZT) + 0.005))
    # belly bay for the drop-out battery cassette (between the belly runners)
    cut_with(pl, prism_z("_bay", rrect(0, 0, CAS_HW + 0.003, CAS_HL + 0.003, 0.031), PLINTH_Z0 - 0.05, 0.3))
    fin(pl, M["cladding"], root, bevel=0.004, seg=3)

    # --- pearl shell, with the maintenance hatch cut from the same surface so it follows the crown ---
    sh = ring_loft("shell_upper", shell_rings())
    cut_arches(sh)
    cut_with(sh, extrude_y("_mask", rrect(0, 0.327, 0.33, 0.04, 0.022), 0.655, 0.9))  # front face mask
    cut_with(sh, extrude_y("_mask", rrect(0, 0.338, 0.29, 0.022, 0.011), -0.9, -0.655))  # rear light bar
    for sx in (-1, 1):
        cut_with(sh, extrude_y("_tail", rrect(sx * 0.318, 0.327, 0.016, 0.045, 0.01), -0.9, -0.655))  # tail lamps
    HY0, HY1, HX, HR, GAP = -0.40, -0.11, 0.23, 0.03, 0.0015
    hc = (HY0 + HY1) / 2
    hatch = bpy.data.objects.new("hatch_main", sh.data.copy())
    SC.objects.link(hatch)
    cut_with(sh, prism_z("_hatch", rrect(0, hc, HX, (HY1 - HY0) / 2, HR), DECK_Z - 0.04, 0.6))
    fin(sh, M["deck"], root, bevel=0.003, seg=3, ex=UP)

    # maintenance hatch: gasketed lid over the battery / service bay, hinged at the mast side (hidden hinges,
    # gas strut); opened from the rear by a flush paddle latch with a key lock. Paddle pocket is sized for gloved
    # fingers; latch and hatch stay flush so nothing snags straps or the panel when it sweeps low.
    keep = prism_z("_hk", rrect(0, hc, HX - GAP, (HY1 - HY0) / 2 - GAP, HR - GAP), DECK_Z - 0.012, 0.6)
    m = hatch.modifiers.new("keep", "BOOLEAN")
    m.operation, m.solver, m.object = "INTERSECT", "EXACT", keep
    apply_mods(hatch)
    bpy.data.objects.remove(keep)
    LY = HY0 + 0.035
    cut(hatch, (0.09, 0.032, 0.016), (0, LY, DECK_Z))  # paddle pocket
    hx = (0, 0, 0.62)
    fin(hatch, M["deck"], root, bevel=0.002, seg=2, ex=hx)
    zt = top_z(0, LY)
    fin(prism_z("latch_pocket", rrect(0, LY, 0.045, 0.016, 0.006), zt - 0.009, zt - 0.007), M["cavity"], root, ex=hx)
    fin(prism_z("latch_paddle", rrect(0, LY + 0.002, 0.04, 0.011, 0.005), zt - 0.0075, zt - 0.0025), M["gunmetal"],
        root, bevel=0.0015, seg=2, ex=hx)
    cyl("latch_lock", 0.0065, 0.004, (0.07, LY, top_z(0.07, LY) - 0.001), M["gunmetal"], root, verts=32,
        bevel=0.001, ex=hx)
    rbox("latch_keyway", 0.0685, 0.0715, LY - 0.004, LY + 0.004, top_z(0.07, LY) + 0.0005,
         top_z(0.07, LY) + 0.0012, M["cavity"], root, ex=hx)

    # --- front face mask: LiDAR (center), stereo cameras, three-projector work/IR lamps each side, and a light
    #     line running concentric inside the mask edge (top and both sides) ---
    fx = (0, 0.12, 0.5)
    MZ, MHW, MHH, MR = 0.327, 0.3265, 0.0365, 0.019
    fin(extrude_y("mask_front", rrect(0, MZ, MHW, MHH, MR), 0.647, 0.657), M["visor"], root, bevel=0.002,
        seg=2, ex=fx)
    fin(extrude_y("lidar_window", rrect(0, 0.325, 0.075, 0.021, 0.008), 0.656, 0.6595), M["lidar_win"], root,
        bevel=0.001, seg=2, ex=fx)
    inset = 0.0065
    lw, lh, lr = MHW - inset, MHH - inset, MR - inset
    path = []
    zc0 = MZ - lh + lr
    for z in np.linspace(zc0, MZ + lh - lr, 6):  # left side, up
        path.append((-lw, z, -1.0, 0.0))
    for i in range(1, 12):  # top-left corner, concentric with the mask corner
        a = math.radians(180 - 90 * i / 12)
        path.append((-lw + lr + lr * math.cos(a), MZ + lh - lr + lr * math.sin(a), math.cos(a), math.sin(a)))
    for x in np.linspace(-lw + lr, lw - lr, 24):
        path.append((x, MZ + lh, 0.0, 1.0))
    for i in range(1, 12):
        a = math.radians(90 - 90 * i / 12)
        path.append((lw - lr + lr * math.cos(a), MZ + lh - lr + lr * math.sin(a), math.cos(a), math.sin(a)))
    for z in np.linspace(MZ + lh - lr, zc0, 6):
        path.append((lw, z, 1.0, 0.0))
    frames = [(Vector((x, 0.657, z)), Vector((nx, 0, nz)), Vector((0, 1, 0))) for x, z, nx, nz in path]
    fin(sweep("led_front", frames, [(-0.0022, 0.0), (0.0022, 0.0), (0.0022, 0.0028), (-0.0022, 0.0028)]),
        M["led_front"], root, ex=fx)
    for sx in (-1, 1):
        side = "L" if sx < 0 else "R"
        cx = sx * 0.135
        cyl(f"cam_ring_front_{side}", 0.012, 0.004, (cx, 0.659, 0.325), M["alu_dark"], root, axis="Y", verts=32,
            bevel=0.001, ex=fx)
        cyl(f"cam_lens_front_{side}", 0.0075, 0.003, (cx, 0.6605, 0.325), M["lens"], root, axis="Y", verts=32, ex=fx)
        for k, px in enumerate((0.212, 0.247, 0.282)):
            cyl(f"projector_{side}_{k}", 0.0145, 0.005, (sx * px, 0.659, 0.325), M["alu_dark"], root, axis="Y",
                verts=40, bevel=0.0015, ex=fx)
            cyl(f"projector_lens_{side}_{k}", 0.0105, 0.004, (sx * px, 0.661, 0.325), M["lens"], root, axis="Y",
                verts=40, ex=fx)

    # corner wrap: side marker continuing the mask's top light line around the plan radius, ending at the arch
    zc = MZ + lh
    d = shell_inset(zc)
    W, L, R = W0 - d, L0 - d, R0 - d
    a, b = W - R, L - R
    for sx in (-1, 1):
        path = []
        samples = [("f", t) for t in np.linspace(0.335, a, 4)] + [("a", t) for t in np.linspace(90, 38, 22)]
        for kind, t in samples:
            if kind == "f":
                p, n = Vector((sx * t, fascia_y(t, zc, 1), zc)), Vector((0, 1, 0))
            else:
                th = math.radians(t)
                n = Vector((sx * math.cos(th), math.sin(th), 0))
                y = b + R * math.sin(th)
                p = Vector((sx * (a + R * math.cos(th)), y, zc)) + n * blister(y, zc) * math.cos(th) ** 2
            path.append((p, n, Vector((0, 0, 1))))
        fin(sweep(f"led_wrap_front_{'L' if sx < 0 else 'R'}", path,
                  [(-0.002, -0.0028), (0.0012, -0.0028), (0.0012, 0.0028), (-0.002, 0.0028)]), M["led_front"], root,
            ex=UP)

    # corner cameras: four fisheyes on the plan radii give 360 deg surround view (people / animals under the
    # panel, remote teleop) and overlap the front stereo pair and the rear camera
    zcam = 0.37
    d = shell_inset(zcam)
    R = R0 - d
    for sx in (-1, 1):
        for s in (1, -1):
            n = Vector((sx, s, 0)).normalized()
            y = s * (L0 - R0 + R * 0.7071)
            p = Vector((sx * (W0 - R0 + R * 0.7071), y, zcam)) + n * (blister(y, zcam) * 0.5 + 0.0012)
            tag = ("F" if s > 0 else "R") + ("L" if sx < 0 else "R")
            for nm, r, dep, mat, off in ((f"cam_corner_{tag}", 0.0115, 0.004, M["sensor"], 0.0),
                                         (f"cam_corner_lens_{tag}", 0.0065, 0.003, M["lens"], 0.0012)):
                o = cyl(nm, r, dep, tuple(p + n * off), mat, root, axis="Y", verts=40, bevel=0.0008, ex=UP)
                o.rotation_euler[2] = -sx * s * math.pi / 4

    # --- rear: full-width bar joining vertical corner lamps (GX), reversing camera ---
    rx = (0, -0.12, 0.5)
    fin(extrude_y("mask_rear", rrect(0, 0.338, 0.2865, 0.0195, 0.009), -0.657, -0.649), M["visor"], root,
        bevel=0.0015, seg=2, ex=rx)
    rbox("led_rear", -0.27, 0.27, -0.6605, -0.656, 0.3355, 0.3405, M["led_rear"], root, bevel=0.0015, seg=2, ex=rx)
    cyl("cam_ring_rear", 0.01, 0.004, (0.2, -0.659, 0.338), M["alu_dark"], root, axis="Y", verts=32, ex=rx)
    cyl("cam_lens_rear", 0.0065, 0.003, (0.2, -0.6605, 0.338), M["lens"], root, axis="Y", verts=32, ex=rx)
    for sx in (-1, 1):
        side = "L" if sx < 0 else "R"
        fin(extrude_y(f"tail_{side}", rrect(sx * 0.318, 0.327, 0.0135, 0.0425, 0.008), -0.6565, -0.6552), M["cavity"],
            root, ex=rx)
        rbox(f"tail_bar_{side}", sx * 0.318 - 0.004, sx * 0.318 + 0.004, -0.6582, -0.6564, 0.29, 0.364, M["led_rear"],
             root, bevel=0.0015, seg=2, ex=rx)
        fin(extrude_y(f"tail_lens_{side}", rrect(sx * 0.318, 0.327, 0.0135, 0.0425, 0.008), -0.6608, -0.6584),
            M["glass"], root, bevel=0.001, seg=2, ex=rx)

    # --- sensors behind the front mask (hidden in the assembled product) ---
    sens = (0, 0.2, 0.5)
    rbox("lidar_body", -0.065, 0.065, 0.61, 0.647, 0.305, 0.345, M["alu_dark"], root, bevel=0.003, ex=sens,
         internal=True)
    for sx in (-1, 1):
        rbox(f"cam_front_{sx}", sx * 0.135 - 0.016, sx * 0.135 + 0.016, 0.62, 0.647, 0.31, 0.34, M["alu_dark"], root,
             bevel=0.003, ex=sens, internal=True)

    # --- arches: swept, rolled flare lips growing out of the plinth; thicker at the bottom where they meet the
    #     bumper as it wraps the corner; liners and axle boots inside ---
    lip = [(-0.005, -0.014), (-0.005, 0.006), (0.0, 0.016), (0.008, 0.021), (0.02, 0.019), (0.034, 0.01),
           (0.046, 0.0), (0.046, -0.014)]
    for sx, yc in wells:
        tag = ("F" if yc > 0 else "R") + ("L" if sx < 0 else "R")
        ax = arch(yc, 0.0, 0.13, 64)
        ax = [ax[0]] + [(ax[0][0], z) for z in np.linspace(0.13, WHEEL_R, 8)[1:-1]] + ax[1:-1] + \
             [(ax[-1][0], z) for z in np.linspace(WHEEL_R, 0.13, 8)[1:-1]] + [ax[-1]]
        path, m_ = [], len(ax)
        for i, (y, z) in enumerate(ax):
            y0, z0 = ax[max(i - 1, 0)]
            y1, z1 = ax[min(i + 1, m_ - 1)]
            t = Vector((0, y1 - y0, z1 - z0)).normalized()
            n = Vector((0, -t.z, t.y))  # away from the wheel, into the body
            bx = body_x(y + n.y * 0.02, z + n.z * 0.02, rib=False)
            k = max(smoothstep(0.12, 0.16, z), 0.05)
            thick = 1 + 0.65 * (1 - smoothstep(0.22, 0.3, z))  # match the bumper's standout low down
            path.append((Vector((sx * bx, y, z)), n * k, Vector((sx, 0, 0)) * k * thick))
        fin(sweep(f"arch_{tag}", path, lip), M["cladding"], root, ex=(sx * 0.2, 0, 0))
        lx = (sx * 0.12, 0, 0)
        fin(extrude_x(f"liner_{tag}", arch(yc, -0.001, 0.15, 48) + arch(yc, -0.008, 0.15, 48)[::-1],
                      *sorted((sx * WELL_X, sx * 0.44))), M["trim"], root, ex=lx)
        fin(extrude_x(f"well_{tag}", arch(yc, -0.001, 0.13, 48), *sorted((sx * (WELL_X + 0.001), sx * (WELL_X + 0.006)))),
            M["trim"], root, smooth=False, ex=lx)
        cyl(f"boot_{tag}", 0.05, 0.012, (sx * (WELL_X + 0.013), yc, WHEEL_R), M["rubber"], root, axis="X", verts=48,
            bevel=0.004, ex=lx)

    # --- plinth hardware ---
    # recovery points: flush covers over threaded sockets on the frame horns (screw-in eye lives in the service
    # bay) — no hook proud of the bumper to snag brush, straps or a neighbouring unit
    for sx in (-1, 1):
        fin(extrude_y(f"tow_cover_front_{'L' if sx < 0 else 'R'}", rrect(sx * 0.29, ZT, 0.0245, 0.0145, 0.005),
                      plinth_y(ZT) - 0.0045, plinth_y(ZT) - 0.001), M["cladding_satin"], root, bevel=0.001, seg=2,
            ex=(0, 0.25, 0))
    # rear: flush hitch receiver plate (tow + recovery on the frame centerline)
    hx = (0, -0.3, 0)
    fin(extrude_y("hitch_plate", rrect(0, ZT, 0.0425, 0.0355, 0.006), -plinth_y(ZT) + 0.001, -plinth_y(ZT) + 0.0045),
        M["gunmetal"], root, bevel=0.0015, seg=2, ex=hx)
    fin(extrude_y("hitch_mouth", rrect(0, ZT, 0.019, 0.019, 0.003), -plinth_y(ZT) + 0.0005, -plinth_y(ZT) + 0.0015),
        M["cavity"], root, ex=hx)
    # ultrasonic array: 4 front + 4 rear, below the LiDAR's field of view — low obstacles, animals, the shaded
    # ground under the panel and the last few cm of docking
    ZU = 0.186
    for s, tag in ((1, "front"), (-1, "rear")):
        for i, ux in enumerate((-0.19, -0.09, 0.09, 0.19)):
            cyl(f"ultrasonic_{tag}_{i}", 0.0105, 0.004, (ux, s * (plinth_y(ZU) - 0.001), ZU), M["sensor"], root,
                axis="Y", verts=40, bevel=0.0012, seg=2, ex=(0, s * 0.25, 0))
    zd = 0.232
    for sx in (-1, 1):  # dock contacts (nose-to-tail charging); copper = energy
        yd = -plinth_y(zd)
        rbox(f"dock_{sx}", sx * 0.17 - 0.03, sx * 0.17 + 0.03, yd - 0.004, yd + 0.003, zd - 0.007, zd + 0.007,
             M["copper"], root, bevel=0.002, ex=(0, -0.25, 0))
    for s, tag in ((1, "front"), (-1, "rear")):  # skid plates under the approach / departure angles
        zs = np.linspace(PLINTH_Z0, 0.152, 8)
        inner = [(0.40, PLINTH_Z0)] + [(plinth_y(z), z) for z in zs]
        outer = [(y + 0.004, z - 0.005) for y, z in inner]
        outer[0] = (0.40, PLINTH_Z0 - 0.005)
        prof = [(s * y, z) for y, z in inner + outer[::-1]]
        fin(extrude_x(f"skid_{tag}", prof, -0.25, 0.25), M["alu"], root, bevel=0.002, seg=2, ex=(0, s * 0.2, -0.12))
    for sx in (-1, 1):  # belly runners: the flat belly between the wheels takes pallet forks
        rbox(f"belly_runner_{sx}", sx * 0.18 - 0.02, sx * 0.18 + 0.02, -0.36, 0.36, PLINTH_Z0 - 0.009, PLINTH_Z0 + 0.001,
             M["alu_dark"], root, bevel=0.004, seg=3, ex=(0, 0, -0.1))

    # --- flanks: status light just above the beltline, mark on the waist between the blisters ---
    zl = 0.274
    for sx in (-1, 1):
        xs = body_x(0.0, zl)
        rbox(f"light_side_{'L' if sx < 0 else 'R'}", *sorted((sx * (xs - 0.003), sx * (xs + 0.0012))), -0.1, 0.1,
             zl - 0.0022, zl + 0.0022, M["status"], root, bevel=0.001, seg=2, ex=UP)

        def on_flank(lx, ly, sx=sx):
            y, z = sx * lx, 0.325 + ly
            return (sx * body_x(y, z), y, z), (-sx, 0, 0)

        logo_decal(f"mark_{'L' if sx < 0 else 'R'}", M, root, on_flank, 0.1, ex=UP)

    # --- platform: roof rails (crew grab handles; ramped end feet carry the lift slots), e-stops, mark ---
    RX, RZ = 0.33, DECK_Z + 0.06
    rex = (0, 0, 0.66)
    for sx in (-1, 1):
        side = "L" if sx < 0 else "R"
        cyl(f"rail_{side}", 0.013, 0.88, (sx * RX, 0, RZ), M["alu_dark"], root, axis="Y", verts=32, bevel=0.003,
            ex=rex)
        rbox(f"rail_foot_{side}_mid", sx * RX - 0.018, sx * RX + 0.018, -0.02, 0.02, DECK_Z - 0.006, RZ + 0.004,
             M["cladding"], root, bevel=0.008, seg=4, ex=rex)
        for s in (1, -1):
            prof = [(0.405, DECK_Z - 0.006), (0.49, DECK_Z - 0.006), (0.475, DECK_Z + 0.02), (0.44, RZ + 0.016),
                    (0.405, RZ + 0.016)]
            ft = extrude_x(f"rail_foot_{side}_{'F' if s > 0 else 'R'}", [(s * y, z) for y, z in prof],
                           sx * RX - 0.021, sx * RX + 0.021)
            cut(ft, (0.1, 0.03, 0.014), (sx * RX, s * 0.452, DECK_Z + 0.03))
            fin(ft, M["cladding"], root, bevel=0.006, seg=3, ex=rex)
    dex = (0, 0, 0.5)
    for i, (ex_, ey) in enumerate(((0.25, -0.5), (-0.25, 0.5))):  # diagonal e-stops: one within reach from any side
        zt = top_z(ex_, ey)
        cyl(f"estop_collar_{i}", 0.03, 0.012, (ex_, ey, zt + 0.004), M["trim"], root, verts=48, bevel=0.003, ex=dex)
        cyl(f"estop_{i}", 0.022, 0.016, (ex_, ey, zt + 0.016), M["estop"], root, verts=48, bevel=0.006, seg=4, ex=dex)

    def on_deck(lx, ly):
        x, y = -lx, 0.47 - ly
        return (x, y, top_z(x, y)), (0, 0, -1)

    logo_decal("mark_deck", M, root, on_deck, 0.12, ex=dex)


def build_beams(root, M):
    """Oscillating drive beams, fully enclosed by the body (seen only in the exploded view)."""
    for s, tag in ((1, "F"), (-1, "R")):
        y = s * BEAM_Y
        bex = (0, 0, -0.2)
        cyl(f"beam_{tag}", BEAM_R, 0.39, (0, y, BEAM_Z), M["alu_dark"], root, axis="X", verts=64, bevel=0.006,
            ex=bex)
        for sx in (-1, 1):
            cyl(f"beam_{tag}_cap{sx}", BEAM_R, 0.135, (sx * 0.2655, y, BEAM_Z), M["body"], root, axis="X", verts=64,
                bevel=0.006, ex=bex)
            cyl(f"beam_{tag}_flange{sx}", BEAM_R + 0.006, 0.008, (sx * 0.33, y, BEAM_Z), M["copper"], root,
                axis="X", verts=64, bevel=0.002, ex=bex)
        rbox(f"pivot_{tag}", -0.05, 0.05, y - 0.04, y + 0.04, BEAM_Z + 0.04, 0.30, M["alu_dark"], root,
             bevel=0.006, ex=bex)
        cyl(f"pivot_pin_{tag}", 0.016, 0.1, (0, y, BEAM_Z + 0.075), M["alu"], root, axis="Y", verts=32, bevel=0.003,
            ex=bex)


def build_wheel(tag, x, y, root, M):
    side = 1 if x > 0 else -1
    w = emp(f"wheel_{tag}", (x, y, WHEEL_R), root, ex=(side * 0.52, 0, 0))
    c = (x, y, WHEEL_R)
    hw, f = WHEEL_W / 2, 0.022

    # tire: revolved rounded profile with a fine knurl across tread and shoulders
    prof = [(-hw + 0.006, RIM_R - 0.004)]
    for i in range(7):
        t = i / 6
        prof.append((-hw - 0.004 * math.sin(math.pi * t), RIM_R + t * (WHEEL_R - f - RIM_R)))
    for i in range(1, 9):
        a = (math.pi / 2) * i / 8
        prof.append((-hw + f - f * math.cos(a), WHEEL_R - f + f * math.sin(a)))
    for i in range(1, 14):
        prof.append((-hw + f + (WHEEL_W - 2 * f) * i / 14, WHEEL_R))
    for i in range(0, 9):
        a = (math.pi / 2) * i / 8
        prof.append((hw - f + f * math.sin(a), WHEEL_R - f + f * math.cos(a)))
    for i in range(1, 7):
        t = i / 6
        prof.append((hw + 0.004 * math.sin(math.pi * (1 - t)), WHEEL_R - f - t * (WHEEL_R - f - RIM_R)))
    prof.append((hw - 0.006, RIM_R - 0.004))
    if side < 0:
        prof = [(-dx, r) for dx, r in prof]
    N = 44

    def knurl(th, dx, r):
        """Staggered block tread: shoulder lugs offset half a pitch side to side, split by a center groove."""
        if r < WHEEL_R - f * 1.05:
            return r
        g = 0.5 + 0.5 * math.tanh(5.0 * math.sin(N * th + (math.pi / 2 if dx > 0 else 0)))
        groove = 0.004 if abs(dx) < 0.005 else 0.0
        return r - 0.0065 * g - groove

    tire = revolve_x(f"tire_{tag}", prof, c, n=N * Q["tire_n"], rmod=knurl if Q["knurl"] else None)
    fin(tire, M["rubber"], w, name=f"tire_{tag}")

    # rim: recessed dished face with concentric ripple rings (the drop motif)
    face_x = hw - 0.013
    rp = [(-hw + 0.012, 0.034)]
    rs = np.linspace(0.034, RIM_R + 0.003, Q["rim_prof"])
    for r in rs:
        k = (r - 0.034) / (RIM_R - 0.031)
        amp = 0.0022 * (1 - 0.6 * k)
        rp.append((face_x - 0.006 * k + amp * math.cos(2 * math.pi * (r - 0.034) / 0.0165) - amp, r))
    rp += [(face_x - 0.012, RIM_R + 0.004), (-hw + 0.012, RIM_R + 0.004)]
    if side < 0:
        rp = [(-dx, r) for dx, r in rp]
    rim = revolve_x(f"rim_{tag}", rp, c, n=Q["rim_n"])
    fin(rim, M["pearl_satin"], w, name=f"rim_{tag}")
    # hub: matte dark-grey cap (hides scuffs, no glare next to the pearl rim), a dark-metal bolt boss that
    # carries the load path, and gloss-black bolts (read as hardware without the chrome sparkle)
    cyl(f"hubcap_{tag}", 0.048, 0.014, (x + side * (face_x - 0.003), y, WHEEL_R), M["hubcap"], w, axis="X",
        verts=96, bevel=0.005, seg=4)
    cyl(f"hub_boss_{tag}", 0.031, 0.008, (x + side * (face_x + 0.0035), y, WHEEL_R), M["gunmetal"], w, axis="X",
        verts=64, bevel=0.002, seg=3)
    cyl(f"hubcap_well_{tag}", 0.008, 0.012, (x + side * (face_x + 0.003), y, WHEEL_R), M["cavity"], w, axis="X",
        verts=32)
    for k in range(5):
        a = 2 * math.pi * k / 5
        screw(f"lug_{tag}_{k}", (x + side * (face_x + 0.0075), y + 0.02 * math.sin(a), WHEEL_R + 0.02 * math.cos(a)),
              "+X" if side > 0 else "-X", M, w, r=0.0042, mat=M["bolt_black"])

    # hub motor (inside the rim): stator core + copper windings
    sex = (-side * 0.2, 0, 0)
    cyl(f"stator_{tag}", 0.078, 0.05, c, M["core"], w, axis="X", verts=48, bevel=0.003, ex=sex, internal=True)
    for k in range(18):
        a = 2 * math.pi * k / 18
        b = box(f"coil_{tag}_{k}", (0.046, 0.018, 0.028),
                (x, y + 0.088 * math.sin(a), WHEEL_R + 0.088 * math.cos(a)), M["copper"], w, bevel=0.005, seg=2,
                ex=sex, internal=True)
        b.rotation_euler = (-a, 0, 0)
    return w


# ---------------------------------------------------------------------------
# Mast, drives and panel
# ---------------------------------------------------------------------------
def build_mast(root, M):
    mex = (0, 0, 0.58)
    cyl("status_ring", 0.082, 0.003, (0, 0, DECK_Z + 0.0015), M["status"], root, verts=96, ex=mex)
    cyl("mast_collar", 0.072, 0.012, (0, 0, DECK_Z + 0.006), M["copper"], root, verts=96, bevel=0.003, ex=mex)
    cyl("mast_flange", 0.058, 0.01, (0, 0, DECK_Z + 0.016), M["trim"], root, verts=64, bevel=0.003, ex=mex)
    for i in range(5):  # bellows gaiter
        bpy.ops.mesh.primitive_torus_add(major_radius=0.043, minor_radius=0.0095, major_segments=64,
                                         minor_segments=16, location=(0, 0, DECK_Z + 0.03 + i * 0.015))
        fin(bpy.context.active_object, M["rubber"], root, name=f"gaiter_{i}", ex=mex)
    cyl("mast_outer", 0.036, MAST_OUTER_TOP - DECK_Z - 0.02, (0, 0, (MAST_OUTER_TOP + DECK_Z + 0.02) / 2),
        M["body"], root, verts=64, bevel=0.004, ex=mex)
    cyl("mast_seal", 0.039, 0.014, (0, 0, MAST_OUTER_TOP), M["trim"], root, verts=64, bevel=0.004, ex=mex)
    # lead screw + motor (internal)
    cyl("mast_screw", 0.009, 0.5, (0, 0, 0.57), M["steel"], root, verts=16, ex=(0, 0, 0.62), internal=True)
    cyl("mast_motor", 0.03, 0.08, (0, 0, 0.2), M["alu_dark"], root, verts=32, bevel=0.004, ex=(0, 0, 0.4),
        internal=True)

    mh = emp("mast_height", (0, 0, MAST_OUTER_TOP), root, ex=(0, 0, 0.68))
    # runs 0.3 m down inside mast_outer so it stays sleeved at full extension (+0.25, see Robot.tsx)
    ib, it = MAST_OUTER_TOP - 0.3, AZ_Z + 0.02
    cyl("mast_inner", 0.029, it - ib, (0, 0, (ib + it) / 2), M["alu"], mh, verts=64, bevel=0.002)

    az = emp("panel_azimuth", (0, 0, AZ_Z), mh, ex=(0, 0, 0.1))
    # azimuth slew drive: split housing with a copper seal ring
    cyl("az_lower", 0.074, 0.026, (0, 0, AZ_Z + 0.013), M["body"], az, verts=96, bevel=0.005, seg=4)
    cyl("az_ring", 0.0725, 0.005, (0, 0, AZ_Z + 0.0285), M["copper"], az, verts=96)
    cyl("az_upper", 0.074, 0.03, (0, 0, AZ_Z + 0.046), M["body"], az, verts=96, bevel=0.005, seg=4)
    cyl("az_motor", 0.021, 0.07, (0, -0.1, AZ_Z + 0.02), M["alu_dark"], az, axis="Y", verts=32, bevel=0.004)
    cyl("az_motor_cap", 0.017, 0.006, (0, -0.137, AZ_Z + 0.02), M["trim"], az, axis="Y", verts=32)
    rbox("az_worm", -0.024, 0.024, -0.08, -0.05, AZ_Z + 0.002, AZ_Z + 0.038, M["body"], az, bevel=0.006)
    # saddle + tilt slew drive housing (fixed to azimuth)
    rbox("saddle", -0.05, 0.05, -0.04, 0.04, AZ_Z + 0.06, TILT_Z - 0.02, M["alu_dark"], az, bevel=0.008)
    cyl("tilt_housing", 0.052, 0.16, (0, 0, TILT_Z), M["body"], az, axis="X", verts=96, bevel=0.006, seg=4)
    rbox("tilt_worm", -0.026, 0.026, -0.075, -0.035, TILT_Z - 0.045, TILT_Z - 0.005, M["body"], az, bevel=0.008)
    cyl("tilt_motor", 0.02, 0.05, (0, -0.095, TILT_Z - 0.025), M["alu_dark"], az, axis="Y", verts=32, bevel=0.004)

    tilt = emp("panel_tilt", (0, 0, TILT_Z), az, ex=(0, 0, 0.08))
    for sx in (-1, 1):
        cyl(f"tilt_flange_{sx}", 0.056, 0.008, (sx * 0.084, 0, TILT_Z), M["copper"], tilt, axis="X", verts=96,
            bevel=0.002)
        # tapered bracket plate from the drive output up to the hub
        ztop = TILT_Z + PZ_BACK - 0.028
        pts = [(0.07, ztop), (-0.07, ztop)] + [(0.05 * math.cos(a), TILT_Z + 0.05 * math.sin(a))
                                               for a in np.linspace(math.pi, 2 * math.pi, 14)]
        pl = extrude_x(f"bracket_{sx}", pts, *sorted((sx * 0.089, sx * 0.101)))
        fin(pl, M["alu_dark"], tilt, bevel=0.004, seg=3)
        cyl(f"tilt_bolt_{sx}", 0.012, 0.006, (sx * 0.103, 0, TILT_Z), M["steel"], tilt, axis="X", verts=6,
            bevel=0.001)
    build_panel(tilt, M)


def ripple_h(r):
    """Drop-in-water ring profile (meters, >= 0), radiating from the hub."""
    r0 = HUB_R + 0.012
    if r <= r0:
        return 0.0
    d = r - r0
    amp = 0.004 + 0.012 * math.exp(-d / 0.3)
    phase = 2 * math.pi * (d / 0.068) ** 0.86
    return amp * (0.5 - 0.5 * math.cos(phase))


def build_panel(tilt, M):
    zb = TILT_Z + PZ_BACK
    hw, hl = PANEL_W / 2, PANEL_L / 2
    inset = 0.012

    # ripple back shell — one molded part; ribs double as stiffeners and a radiating surface
    step = Q["backshell_step"]
    xs = np.arange(-hw + inset, hw - inset + 1e-9, step)
    ys = np.arange(-hl + inset, hl - inset + 1e-9, step)
    nx, ny = len(xs), len(ys)
    X, Y = np.meshgrid(xs, ys)
    R = np.sqrt(X ** 2 + Y ** 2)
    H = np.vectorize(ripple_h)(R) if Q["ripple"] else np.zeros_like(R)
    edge = np.minimum(hw - inset - np.abs(X), hl - inset - np.abs(Y))
    fade = np.clip(edge / 0.05, 0, 1)
    fade = fade * fade * (3 - 2 * fade)
    Z = zb - 0.002 - H * fade
    verts = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
    faces = [(j * nx + i, j * nx + i + 1, (j + 1) * nx + i + 1, (j + 1) * nx + i)
             for j in range(ny - 1) for i in range(nx - 1)]
    shell = raw("panel_backshell", verts, faces)
    sol = shell.modifiers.new("thick", "SOLIDIFY")
    sol.thickness, sol.offset = 0.0025, 1.0
    fin(shell, M["pearl_satin"], tilt, name="panel_backshell", ex=(0, 0, 0.1))

    # mount hub — the point where the drop lands
    cyl("hub_plate", HUB_R, 0.012, (0, 0, zb - 0.008), M["body"], tilt, verts=128, bevel=0.004, seg=3)
    cyl("hub_ring", HUB_R - 0.018, 0.004, (0, 0, zb - 0.0155), M["copper"], tilt, verts=128)
    cyl("hub_boss", HUB_R - 0.03, 0.014, (0, 0, zb - 0.0235), M["body"], tilt, verts=128, bevel=0.004, seg=3)
    for k in range(8):
        a = 2 * math.pi * k / 8
        screw(f"hub_screw_{k}", (0.108 * math.cos(a), 0.108 * math.sin(a), zb - 0.014), "-Z", M, tilt, r=0.0045)
    # MPPT / junction electronics inside the hub (internal)
    cyl("mppt", 0.085, 0.012, (0, 0, zb - 0.004), M["pcb"], tilt, verts=64, ex=(0, 0, 0.07), internal=True)

    # frame: thin brushed extrusion + dark molded corner caps
    fz0, fz1 = zb - 0.02, zb + 0.0105
    fex = (0, 0, 0.19)
    t = 0.011
    rbox("frame_L", -hw, -hw + t, -hl + 0.03, hl - 0.03, fz0, fz1, M["alu"], tilt, bevel=0.003, seg=3, ex=fex)
    rbox("frame_R", hw - t, hw, -hl + 0.03, hl - 0.03, fz0, fz1, M["alu"], tilt, bevel=0.003, seg=3, ex=fex)
    rbox("frame_F", -hw + 0.03, hw - 0.03, hl - t, hl, fz0, fz1, M["alu"], tilt, bevel=0.003, seg=3, ex=fex)
    rbox("frame_B", -hw + 0.03, hw - 0.03, -hl, -hl + t, fz0, fz1, M["alu"], tilt, bevel=0.003, seg=3, ex=fex)
    for sx in (-1, 1):
        for sy in (-1, 1):
            rbox(f"corner_{sx}{sy}", *sorted((sx * hw + sx * 0.001, sx * (hw - 0.036))),
                 *sorted((sy * hl + sy * 0.001, sy * (hl - 0.036))), fz0 - 0.001, fz1 + 0.0015, M["trim"], tilt,
                 bevel=0.009, seg=5, ex=fex)
    # dual RTK-GNSS antennas in two diagonal corner caps: the highest, never-shaded points on the robot (the
    # panel would block sky view from the deck); the 1.9 m baseline also gives heading at standstill
    for sx, sy, tag in ((-1, 1, "F"), (1, -1, "R")):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0165, location=(sx * (hw - 0.0175), sy * (hl - 0.0175), fz1 + 0.0015),
                                             segments=32, ring_count=16)
        g = bpy.context.active_object
        g.scale = (1, 1, 0.5)
        bpy.ops.object.transform_apply(scale=True)
        fin(g, M["trim"], tilt, name=f"gnss_{tag}", ex=fex)

    # cell laminate + cover glass
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, zb + 0.0045))
    cells = bpy.context.active_object
    cells.scale = (PANEL_W - 2 * t, PANEL_L - 2 * t, 1)
    bpy.ops.object.transform_apply(scale=True)
    fin(cells, M["pv"], tilt, smooth=False, name="panel_cells", ex=(0, 0, 0.28))
    rbox("panel_glass", -hw + t, hw - t, -hl + t, hl - t, zb + 0.0055, zb + 0.0087, M["glass"], tilt, bevel=0.0008,
         seg=1, ex=(0, 0, 0.37))


# ---------------------------------------------------------------------------
# Assembly
# ---------------------------------------------------------------------------
def build(name="SolarBot", tex_dir=None):
    global SC
    SC = bpy.context.scene.collection
    M = materials(tex_dir or os.path.join(br.ROOT, "public", "models", "textures"))
    root = bpy.data.objects.new(name, None)
    root.empty_display_type = "ARROWS"
    SC.objects.link(root)

    # battery cassette: the 5 kWh LFP pack drops out of the belly at the swap station (props_v2.swap_station).
    # Visible from below: four latch pins, two alignment sockets for the lift's cones, a recessed blind-mate power /
    # data connector (copper = energy) and a finger pull for a manual swap. The belly runners either side guide the
    # robot along the swap deck (and take pallet forks).
    cax = (0, 0, -0.36)
    zb = PLINTH_Z0 - 0.006
    fin(prism_z("battery_cassette", rrect(0, 0, CAS_HW, CAS_HL, 0.028), zb, 0.3), M["alu_dark"], root, bevel=0.003,
        seg=2, ex=cax)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl(f"cassette_latch_{sx}{sy}", 0.011, 0.006, (sx * 0.115, sy * 0.255, zb - 0.001), M["gunmetal"], root,
                verts=32, bevel=0.0015, seg=2, ex=cax)
        cyl(f"cassette_align_{sx}", 0.014, 0.004, (sx * 0.1, 0.0, zb + 0.0012), M["cavity"], root, verts=32, ex=cax)
    fin(prism_z("cassette_connector", rrect(0, 0.17, 0.055, 0.022, 0.01), zb - 0.0004, zb + 0.002), M["cavity"], root,
        ex=cax)
    for k in (-1, 0, 1):
        rbox(f"cassette_pin_{k}", k * 0.03 - 0.009, k * 0.03 + 0.009, 0.162, 0.178, zb - 0.0008, zb + 0.001,
             M["copper"], root, bevel=0.001, seg=1, ex=cax)
    fin(prism_z("cassette_pull", rrect(0, -0.19, 0.05, 0.012, 0.011), zb - 0.0004, zb + 0.003), M["cavity"], root,
        ex=cax)
    for i in range(2):  # cells inside the cassette (hidden in the assembled product)
        for j in range(3):
            x0, y0 = -0.135 + i * 0.137, -0.28 + j * 0.188
            rbox(f"cell_module_{i}{j}", x0, x0 + 0.133, y0, y0 + 0.182, 0.125, 0.27, M["cell_wrap"], root,
                 bevel=0.006, ex=cax, internal=True)
            rbox(f"busbar_{i}{j}", x0 + 0.02, x0 + 0.113, y0 + 0.08, y0 + 0.1, 0.27, 0.274, M["copper"], root,
                 bevel=0.001, ex=cax, internal=True)
    rbox("bms", -0.13, 0.13, -0.28, 0.28, 0.276, 0.284, M["pcb"], root, bevel=0.002, ex=cax, internal=True)
    # compute + fuses sit in the service bay under the top hatch
    cex = (0, 0, 0.36)
    rbox("compute", -0.13, 0.13, -0.35, -0.17, 0.33, 0.345, M["pcb"], root, bevel=0.002, ex=cex, internal=True)
    for k in range(15):
        x = -0.11 + k * 0.0157
        rbox(f"heatsink_{k}", x - 0.0018, x + 0.0018, -0.34, -0.18, 0.345, 0.368, M["alu"], root, ex=cex,
             internal=True)

    build_chassis(root, M)
    build_beams(root, M)
    for tag, sx, sy in (("FL", -1, 1), ("FR", 1, 1), ("RL", -1, -1), ("RR", 1, -1)):
        build_wheel(tag, sx * WHEEL_X, sy * BEAM_Y, root, M)
    build_mast(root, M)
    return root


def pose(root, tilt=0.0, azimuth=0.0, mast=0.0):
    objs = {o.name.split(".")[0]: o for o in root.children_recursive}
    objs["panel_tilt"].rotation_euler[0] = tilt
    objs["panel_azimuth"].rotation_euler[2] = azimuth
    objs["mast_height"].location[2] = MAST_OUTER_TOP + mast
    return objs


def set_internal_visible(root, visible):
    for o in root.children_recursive:
        if o.get("internal"):
            o.hide_render = not visible
            o.hide_viewport = not visible


def explode(root, f=1.0):
    for o in root.children_recursive:
        if "ex" in o:
            o.location = o.location + Vector(o["ex"]) * f
    bpy.context.view_layer.update()


if __name__ == "__main__":
    br.clear_scene()
    r = build()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "solarbot_v2.blend"))
    print("BUILT", len(r.children_recursive), "objects")
