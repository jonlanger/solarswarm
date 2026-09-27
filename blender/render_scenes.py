"""Photoreal Cycles renders of the SolarSwarm robot.

  Blender -b -P blender/render_scenes.py -- <shot> [--preview] [--samples N]

Shots: hero, detail_sensor, detail_wheel, array, formation, onboarding, satellite, tracking (animation),
       studio (neutral turntable-style still for the design-system page)
Outputs to public/renders/<shot>.png (or <shot>_####.png for animations).
"""

import math
import os
import random
import sys

import bpy
from mathutils import Euler, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_robot as br  # noqa: E402

OUT = os.path.join(br.ROOT, "public", "renders")


# ---------------------------------------------------------------------------
# Render / world setup
# ---------------------------------------------------------------------------
def setup_render(samples=160, res=(1920, 1080), preview=False):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    try:
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        sc.cycles.device = "GPU"
    except Exception as e:  # CPU fallback
        print("GPU unavailable:", e)
    sc.cycles.samples = 24 if preview else samples
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = "OPENIMAGEDENOISE"
    sc.cycles.max_bounces = 8
    sc.cycles.glossy_bounces = 4
    sc.cycles.transmission_bounces = 4
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 50 if preview else 100
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_depth = "8"
    return sc


def sky(sun_elev_deg=18, sun_rot_deg=-40, strength=0.35, sun_intensity=1.0, dust=1.2, air=1.0):
    w = bpy.data.worlds.new("World")
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    s = nt.nodes.new("ShaderNodeTexSky")
    s.sky_type = "NISHITA"
    s.sun_elevation = math.radians(sun_elev_deg)
    s.sun_rotation = math.radians(sun_rot_deg)
    s.sun_intensity = sun_intensity
    s.air_density = air
    s.dust_density = dust
    s.altitude = 200
    bg.inputs["Strength"].default_value = strength
    bpy.context.scene.view_settings.exposure = -0.2 - 0.5 * max(0.0, min(1.0, (sun_elev_deg - 12) / 30))
    nt.links.new(s.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    return s


def studio_world(color=(0.02, 0.018, 0.03), strength=1.0):
    w = bpy.data.worlds.new("Studio")
    bpy.context.scene.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (*color, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = strength


def area_light(name, loc, rot, size, power, color=(1, 1, 1)):
    d = bpy.data.lights.new(name, "AREA")
    d.size = size
    d.energy = power
    d.color = color
    o = bpy.data.objects.new(name, d)
    o.location = loc
    o.rotation_euler = rot
    bpy.context.scene.collection.objects.link(o)
    return o


def look_at(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def camera(loc, target, lens=50, dof=None, fstop=2.8, ortho=None):
    c = bpy.data.cameras.new("Cam")
    c.lens = lens
    c.sensor_width = 36
    if ortho:
        c.type = "ORTHO"
        c.ortho_scale = ortho
    if dof:
        c.dof.use_dof = True
        c.dof.focus_distance = dof
        c.dof.aperture_fstop = fstop
    o = bpy.data.objects.new("Cam", c)
    o.location = loc
    bpy.context.scene.collection.objects.link(o)
    look_at(o, target)
    bpy.context.scene.camera = o
    c.clip_end = 5000
    return o


# ---------------------------------------------------------------------------
# Terrain (procedural dry grass / packed dirt with displacement)
# ---------------------------------------------------------------------------
def terrain_material(kind="grass"):
    m = bpy.data.materials.new(f"Terrain_{kind}")
    m.use_nodes = True
    nt = m.node_tree
    N = nt.nodes
    L = nt.links
    b = N["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.92
    tc = N.new("ShaderNodeTexCoord")
    mp = N.new("ShaderNodeMapping")
    L.new(tc.outputs["Object"], mp.inputs["Vector"])

    def noise(scale, detail=8, rough=0.6):
        n = N.new("ShaderNodeTexNoise")
        n.inputs["Scale"].default_value = scale
        n.inputs["Detail"].default_value = detail
        n.inputs["Roughness"].default_value = rough
        L.new(mp.outputs["Vector"], n.inputs["Vector"])
        return n

    big = noise(0.08, 6, 0.55)
    mid = noise(0.9, 10, 0.6)
    fine = noise(18, 12, 0.7)
    vor = N.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 60
    L.new(mp.outputs["Vector"], vor.inputs["Vector"])

    # color: mix dirt ↔ dry grass by large noise
    ramp = N.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    if kind == "grass":
        cr.elements[0].position = 0.38
        cr.elements[0].color = (*br.srgb("#7a6446"), 1)  # dirt
        cr.elements[1].position = 0.62
        cr.elements[1].color = (*br.srgb("#8a8a4a"), 1)  # dry grass
        e = cr.elements.new(0.5)
        e.color = (*br.srgb("#9b8a5c"), 1)
    elif kind == "sat":
        cr.elements[0].position = 0.3
        cr.elements[0].color = (*br.srgb("#3f4a2a"), 1)
        cr.elements[1].position = 0.72
        cr.elements[1].color = (*br.srgb("#a08c66"), 1)
        e = cr.elements.new(0.5)
        e.color = (*br.srgb("#6c6c40"), 1)
        big.inputs["Scale"].default_value = 0.025
        mid.inputs["Scale"].default_value = 0.2
    else:  # desert / gravel pad
        cr.elements[0].position = 0.3
        cr.elements[0].color = (*br.srgb("#9a7e5d"), 1)
        cr.elements[1].position = 0.75
        cr.elements[1].color = (*br.srgb("#c2a888"), 1)
    mix_in = N.new("ShaderNodeMath")
    mix_in.operation = "ADD"
    L.new(big.outputs["Fac"], mix_in.inputs[0])
    scaled = N.new("ShaderNodeMath")
    scaled.operation = "MULTIPLY"
    scaled.inputs[1].default_value = 0.35
    L.new(mid.outputs["Fac"], scaled.inputs[0])
    L.new(scaled.outputs[0], mix_in.inputs[1])
    sub = N.new("ShaderNodeMath")
    sub.operation = "SUBTRACT"
    sub.inputs[1].default_value = 0.17
    L.new(mix_in.outputs[0], sub.inputs[0])
    L.new(sub.outputs[0], ramp.inputs["Fac"])

    # fine albedo variation
    fine_mix = N.new("ShaderNodeMixRGB")
    fine_mix.blend_type = "MULTIPLY"
    fine_mix.inputs["Fac"].default_value = 0.35
    L.new(ramp.outputs["Color"], fine_mix.inputs[1])
    fr = N.new("ShaderNodeValToRGB")
    fr.color_ramp.elements[0].color = (0.55, 0.55, 0.55, 1)
    fr.color_ramp.elements[1].color = (1, 1, 1, 1)
    L.new(fine.outputs["Fac"], fr.inputs["Fac"])
    L.new(fr.outputs["Color"], fine_mix.inputs[2])
    L.new(fine_mix.outputs["Color"], b.inputs["Base Color"])

    # bump from fine noise + voronoi pebbles
    bump = N.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.6
    bump.inputs["Distance"].default_value = 0.02
    add = N.new("ShaderNodeMath")
    add.operation = "ADD"
    L.new(fine.outputs["Fac"], add.inputs[0])
    L.new(vor.outputs["Distance"], add.inputs[1])
    L.new(add.outputs[0], bump.inputs["Height"])
    L.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def ground(size=400, kind="grass", subdiv=0):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, 0))
    g = bpy.context.active_object
    g.name = "Ground"
    g.data.materials.append(terrain_material(kind))
    if subdiv:
        m = g.modifiers.new("sub", "SUBSURF")
        m.subdivision_type = "SIMPLE"
        m.levels = m.render_levels = subdiv
        tex = bpy.data.textures.new("gdisp", "CLOUDS")
        tex.noise_scale = 6
        d = g.modifiers.new("disp", "DISPLACE")
        d.texture = tex
        d.strength = 0.25
        d.mid_level = 0.5
    return g


def hills(inner=260, outer=2600, height=70, res=260, seed=4):
    """Distant rolling hills: a terrain ring that stays flat inside `inner` and rises beyond it."""
    import bmesh
    from mathutils import noise

    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=res, y_segments=res, size=outer)
    off = Vector((seed * 17.3, seed * 7.1, 0))
    for v in bm.verts:
        d = v.co.xy.length
        t = min(1.0, max(0.0, (d - inner) / (inner * 1.6)))
        mask = t * t * (3 - 2 * t)
        n = noise.fractal(v.co / 900 + off, 0.6, 2.2, 5)
        v.co.z = (n * 0.5 + 0.55) * height * mask - 0.5
    me = bpy.data.meshes.new("Hills")
    bm.to_mesh(me)
    bm.free()
    h = bpy.data.objects.new("Hills", me)
    bpy.context.scene.collection.objects.link(h)
    for p in me.polygons:
        p.use_smooth = True
    h.data.materials.append(terrain_material("grass"))
    return h


def grass_scatter(area=30, count=60000, center=(0, 0), avoid=None, seed=1):
    """Dry grass tufts as a particle hair system on a patch — realism near camera."""
    bpy.ops.mesh.primitive_plane_add(size=area, location=(center[0], center[1], 0.001))
    p = bpy.context.active_object
    p.name = "GrassPatch"
    mat = bpy.data.materials.new("GrassBlade")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.7
    info = nt.nodes.new("ShaderNodeHairInfo")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*br.srgb("#4d4a2a"), 1)
    ramp.color_ramp.elements[1].color = (*br.srgb("#b8a877"), 1)
    nt.links.new(info.outputs["Random"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    # hide the carrier plane itself
    hide = bpy.data.materials.new("Invisible")
    hide.use_nodes = True
    hn = hide.node_tree
    hn.nodes.remove(hn.nodes["Principled BSDF"])
    tr = hn.nodes.new("ShaderNodeBsdfTransparent")
    hn.links.new(tr.outputs[0], hn.nodes["Material Output"].inputs["Surface"])
    p.data.materials.append(hide)
    p.data.materials.append(mat)

    ps_mod = p.modifiers.new("grass", "PARTICLE_SYSTEM")
    ps = ps_mod.particle_system.settings
    ps.type = "HAIR"
    ps.count = count
    ps.hair_length = 0.1
    ps.use_advanced_hair = False
    ps.material = 2
    ps.render_step = 3
    ps.display_step = 2
    ps.root_radius = 0.6
    ps.tip_radius = 0.0
    ps.radius_scale = 0.004
    ps.length_random = 0.8
    ps.use_rotations = True
    ps.rotation_factor_random = 0.3
    ps.phase_factor_random = 1.0
    ps.brownian_factor = 0.02
    ps.child_type = "INTERPOLATED"
    ps.child_percent = 3
    ps.rendered_child_count = 6
    ps.child_length = 0.9
    ps.clump_factor = 0.4
    ps.roughness_1 = 0.03
    ps.roughness_endpoint = 0.05
    ps.kink = "CURL"
    ps.kink_amplitude = 0.01
    ps_mod.particle_system.seed = seed
    return p


def flatbed_truck(loc=(0, 0, 0), rot_z=0.0):
    """Cab-over flatbed (cab faces +Y), bed deck at z≈1.3, rear at y≈-4.3."""
    M = br.materials()
    paint = br._principled("Truck_Paint", br.srgb("#ecebf0"), rough=0.22, coat=1.0, coat_rough=0.04)
    glass = br._principled("Truck_Glass", br.srgb("#07080c"), rough=0.02, coat=1.0, coat_rough=0.0)
    light = br._principled("Headlight", (1, 1, 1), **{"Emission Color": (1, 0.95, 0.85, 1), "Emission Strength": 10})
    tail = br._principled("Taillight", br.srgb("#ff3030"), **{"Emission Color": (1, 0.1, 0.08, 1), "Emission Strength": 6})
    coll = bpy.context.scene.collection
    root = bpy.data.objects.new("Truck", None)
    coll.objects.link(root)
    # frame + fuel tanks
    br.box("frame", (1.0, 10.2, 0.28), (0, 0.3, 0.86), M["trim"], root, coll, bevel=0.03)
    for sx in (-1, 1):
        br.cyl(f"tank_{sx}", 0.28, 1.2, (sx * 0.95, 2.2, 0.85), M["alu"], root, coll, axis="Y", bevel=0.05)
    # cab: lower body + upper cabin with raked windshield
    br.box("cab_low", (2.45, 2.1, 1.1), (0, 4.45, 1.5), paint, root, coll, bevel=0.12, segments=6)
    cab = br.box("cab_up", (2.45, 1.9, 1.15), (0, 4.35, 2.6), paint, root, coll, bevel=0.2, segments=6)
    ws = br.box("windshield", (2.2, 0.04, 0.95), (0, 5.33, 2.55), glass, root, coll, bevel=0.04)
    ws.rotation_euler[0] = math.radians(-8)
    for sx in (-1, 1):
        br.box(f"sidewin_{sx}", (0.04, 1.05, 0.72), (sx * 1.225, 4.55, 2.62), glass, root, coll, bevel=0.03)
        br.box(f"mirror_{sx}", (0.08, 0.14, 0.42), (sx * 1.42, 5.25, 2.5), M["trim"], root, coll, bevel=0.03)
        br.box(f"step_{sx}", (0.12, 0.6, 0.06), (sx * 1.2, 4.3, 0.75), M["alu"], root, coll, bevel=0.01)
        br.box(f"headlight_{sx}", (0.42, 0.04, 0.14), (sx * 0.78, 5.51, 1.3), light, root, coll, bevel=0.02)
        br.box(f"tail_{sx}", (0.25, 0.04, 0.1), (sx * 1.0, -4.62, 1.1), tail, root, coll, bevel=0.01)
    br.box("grille", (1.5, 0.05, 0.55), (0, 5.51, 1.55), M["trim"], root, coll, bevel=0.02)
    br.box("bumper", (2.5, 0.25, 0.3), (0, 5.55, 0.82), M["alu_dark"], root, coll, bevel=0.06)
    br.box("brand_stripe", (2.47, 1.6, 0.08), (0, 4.4, 2.05), M["copper"], root, coll, bevel=0.02)
    br.box("roof_led", (1.2, 0.05, 0.05), (0, 5.2, 3.2), M["led_front"], root, coll, bevel=0.01)
    # bed
    br.box("bed", (2.5, 8.2, 0.16), (0, -0.4, 1.2), M["alu_dark"], root, coll, bevel=0.03)
    br.box("bed_edge", (2.54, 8.24, 0.05), (0, -0.4, 1.13), M["copper"], root, coll, bevel=0.01)
    br.box("headboard", (2.4, 0.12, 1.1), (0, 3.3, 1.8), M["alu"], root, coll, bevel=0.03)
    # wheels (front single, rear tandem duals)
    for (y, n) in ((4.3, 1), (-2.3, 2), (-3.5, 2)):
        for sx in (-1, 1):
            wx = sx * (1.0 if n == 1 else 0.95)
            br.cyl(f"twheel_{y}_{sx}", 0.52, 0.32 * n, (wx, y, 0.52), M["rubber"], root, coll, axis="X",
                   verts=64, bevel=0.07, segments=5)
            br.cyl(f"trim_{y}_{sx}", 0.3, 0.32 * n + 0.02, (wx, y, 0.52), M["alu"], root, coll, axis="X",
                   verts=48, bevel=0.02)
            br.cyl(f"hubnut_{y}_{sx}", 0.1, 0.32 * n + 0.05, (wx, y, 0.52), M["alu_dark"], root, coll, axis="X",
                   verts=32)
    br.box("fender_front", (2.6, 1.3, 0.08), (0, 4.3, 1.08), M["trim"], root, coll, bevel=0.03)
    root.location = loc
    root.rotation_euler[2] = rot_z
    return root


def portal(loc=(0, 0, 0), rot_z=0.0, width=3.2, height=2.8):
    """SolarSwarm onboarding portal: arch with purple light strip — robots pair as they pass through."""
    M = br.materials()
    coll = bpy.context.scene.collection
    root = bpy.data.objects.new("Portal", None)
    coll.objects.link(root)
    for sx in (-1, 1):
        br.box(f"post_{sx}", (0.22, 0.3, height), (sx * width / 2, 0, height / 2), M["body"], root, coll,
               bevel=0.05)
        br.box(f"post_led_{sx}", (0.03, 0.04, height - 0.4), (sx * (width / 2 - 0.115), 0.0, height / 2),
               M["led_front"], root, coll, bevel=0.01)
        br.box(f"foot_{sx}", (0.5, 0.8, 0.08), (sx * width / 2, 0, 0.04), M["alu_dark"], root, coll, bevel=0.02)
    br.box("beam", (width + 0.22, 0.34, 0.3), (0, 0, height + 0.15), M["body"], root, coll, bevel=0.06)
    br.box("beam_copper", (width + 0.24, 0.36, 0.05), (0, 0, height + 0.02), M["copper"], root, coll, bevel=0.01)
    br.box("beam_led", (width - 0.3, 0.04, 0.04), (0, 0.0, height - 0.02), M["led_front"], root, coll, bevel=0.01)
    root.location = loc
    root.rotation_euler[2] = rot_z
    return root


def robot_grid(rows, cols, sx=2.2, sy=2.6, origin=(0, 0), jitter=0.0, tilt=0.5, az=0.0, low=True, seed=3,
               skip=lambda r, c: False):
    """Instance a (low-detail) robot many times via collection instances."""
    rng = random.Random(seed)
    src = bpy.data.collections.get("BotSrc")
    if not src:
        src = bpy.data.collections.new("BotSrc")
        bpy.context.scene.collection.children.link(src)
        r = br.build_robot("BotProto", low=low, coll=src)
        br.pose(r, tilt=tilt, azimuth=az)
        bpy.context.view_layer.layer_collection.children["BotSrc"].exclude = True
    insts = []
    for i in range(rows):
        for j in range(cols):
            if skip(i, j):
                continue
            o = bpy.data.objects.new(f"bot_{i}_{j}", None)
            o.instance_type = "COLLECTION"
            o.instance_collection = src
            o.location = (origin[0] + j * sx + rng.uniform(-jitter, jitter),
                          origin[1] + i * sy + rng.uniform(-jitter, jitter), 0)
            o.rotation_euler[2] = rng.uniform(-0.02, 0.02)
            bpy.context.scene.collection.objects.link(o)
            insts.append(o)
    return insts


def render(name):
    os.makedirs(OUT, exist_ok=True)
    sc = bpy.context.scene
    sc.render.filepath = os.path.join(OUT, f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", sc.render.filepath)


# ---------------------------------------------------------------------------
# Shots
# ---------------------------------------------------------------------------
def shot_studio(args):
    setup_render(args.samples, (1600, 1600), args.preview)
    studio_world((0.03, 0.025, 0.045), 0.6)
    r = br.build_robot()
    br.pose(r, tilt=math.radians(30), azimuth=math.radians(150))
    # seamless cyclorama
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0))
    floor = bpy.context.active_object
    floor.data.materials.append(br._principled("Cyc", br.srgb("#0e0c14"), rough=0.55))
    area_light("key", (3.2, 2.5, 4.0), Euler((math.radians(40), 0, math.radians(128))), 3.0, 900,
               (1.0, 0.93, 0.88))
    area_light("rim_violet", (-3.0, -2.5, 2.4), Euler((math.radians(65), 0, math.radians(-50))), 2.0, 700,
               (0.62, 0.45, 1.0))
    area_light("rim_copper", (2.8, -3.2, 1.2), Euler((math.radians(80), 0, math.radians(40))), 1.5, 380,
               (1.0, 0.62, 0.35))
    area_light("top", (0, 0, 5), Euler((0, 0, 0)), 4, 90)
    camera((3.1, 3.4, 1.55), (0, 0, 0.62), lens=50, dof=4.6, fstop=5.6)
    render("studio")


def shot_hero(args):
    setup_render(args.samples, (2560, 1440), args.preview)
    sky(sun_elev_deg=11, sun_rot_deg=-120, strength=0.28, dust=2.2)
    ground(600, "grass")
    grass_scatter(area=24, count=90000 if not args.preview else 15000)
    r = br.build_robot()
    br.pose(r, tilt=math.radians(62), azimuth=math.radians(112), mast=0.1)
    r.rotation_euler[2] = math.radians(8)
    hills()
    # the deployed array receding behind the hero unit
    robot_grid(9, 16, sx=2.3, sy=2.9, origin=(-19, -30), jitter=0.04, tilt=math.radians(62),
               az=math.radians(120), skip=lambda r, c: r >= 7 and 6 <= c <= 10)
    camera((2.3, 3.1, 0.55), (-0.2, -0.4, 0.85), lens=32, dof=3.6, fstop=2.2)
    render("hero")


def shot_detail_sensor(args):
    setup_render(args.samples, (1600, 1200), args.preview)
    sky(sun_elev_deg=14, sun_rot_deg=20, strength=0.3, dust=1.8)
    ground(200, "grass")
    grass_scatter(area=8, count=30000 if not args.preview else 6000)
    r = br.build_robot()
    br.pose(r, tilt=math.radians(35), azimuth=math.radians(30))
    camera((0.55, 1.35, 0.42), (0, 0.5, 0.32), lens=70, dof=0.95, fstop=2.0)
    render("detail_sensor")


def shot_detail_wheel(args):
    setup_render(args.samples, (1600, 1200), args.preview)
    sky(sun_elev_deg=22, sun_rot_deg=60, strength=0.3)
    ground(200, "grass")
    grass_scatter(area=8, count=30000 if not args.preview else 6000)
    r = br.build_robot()
    br.pose(r, tilt=math.radians(20), azimuth=0)
    camera((1.35, 0.95, 0.22), (0.43, 0.4, 0.18), lens=60, dof=1.1, fstop=2.2)
    render("detail_wheel")


def shot_array(args):
    """Aerial of a deployed field — golden hour."""
    setup_render(args.samples, (2560, 1440), args.preview)
    sky(sun_elev_deg=18, sun_rot_deg=-75, strength=0.32, dust=1.6)
    ground(1200, "grass", subdiv=0)
    hills()
    robot_grid(18, 26, sx=1.9, sy=2.4, origin=(-24, -20), jitter=0.05, tilt=math.radians(55),
               az=math.radians(75))
    camera((32, -34, 22), (0, 2, 0), lens=45)
    render("array")


def shot_formation(args):
    """Robots rolling from a queue into rows."""
    setup_render(args.samples, (2560, 1440), args.preview)
    sky(sun_elev_deg=24, sun_rot_deg=-40, strength=0.3)
    ground(800, "grass")
    hills()
    # finished rows
    robot_grid(4, 12, sx=1.9, sy=2.4, origin=(-10, 0), tilt=0.0,
               skip=lambda r, c: r == 3 and c > 6)
    # queue in a snaking line toward the empty slots
    src = bpy.data.collections["BotSrc"]
    for k in range(9):
        o = bpy.data.objects.new(f"q{k}", None)
        o.instance_type = "COLLECTION"
        o.instance_collection = src
        t = k / 8
        o.location = (4 + t * 12, 7.2 + math.sin(t * 3.0) * 2.5 + t * 3, 0)
        o.rotation_euler[2] = math.radians(90 + math.cos(t * 3.0) * 25)
        bpy.context.scene.collection.objects.link(o)
    camera((16, -12, 11), (2, 5, 0), lens=40)
    render("formation")


def shot_onboarding(args):
    """Truck parked, rear ramp down, robots roll through the pairing portal and fan out."""
    setup_render(args.samples, (2560, 1440), args.preview)
    sky(sun_elev_deg=26, sun_rot_deg=-140, strength=0.3, dust=1.5)
    ground(600, "desert")
    hills()
    flatbed_truck((0, 0, 0))
    # robots still on the bed: panels flat, masts retracted
    for k, y in enumerate((2.1, 0.3, -1.5)):
        for sx in (-0.62, 0.62):
            rr = br.build_robot(f"Bed{k}{sx}", low=True)
            br.pose(rr, tilt=0, mast=-0.18)
            rr.location = (sx, y, 1.28)
            rr.rotation_euler[2] = math.pi
    # rear ramp to ground
    rmat = br.materials()["alu"]
    ramp = br.box("ramp", (1.3, 3.3, 0.05), (0, -5.95, 0.62), rmat, None, bpy.context.scene.collection, bevel=0.01)
    ramp.rotation_euler[0] = math.radians(21.5)
    for sx in (-1, 1):
        br.box(f"ramp_rail_{sx}", (0.05, 3.3, 0.08), (sx * 0.67, -5.95, 0.66), br.materials()["copper"], ramp, bpy.context.scene.collection)
    # one robot rolling down the ramp
    rr = br.build_robot("OnRamp", low=True)
    br.pose(rr, tilt=0, mast=-0.18)
    rr.location = (0, -5.6, 0.79)
    rr.rotation_euler = (math.radians(-21.5), 0, math.pi)
    # portal at the foot of the ramp
    portal((0, -9.3, 0))
    # robots through the portal, raising masts and fanning into a queue
    path = [(0.0, -11.2, 0), (1.3, -12.9, 0.3), (3.2, -14.0, 0.6), (5.4, -14.6, 0.9), (7.8, -14.9, 1.0)]
    for k, (x, y, t) in enumerate(path):
        rb = br.build_robot(f"Out{k}", low=k > 1)
        br.pose(rb, tilt=math.radians(35 * t), azimuth=math.radians(140) * t, mast=-0.18 + 0.26 * t)
        rb.location = (x, y, 0)
        rb.rotation_euler[2] = math.pi + math.radians(-55 * t)
    camera((-6.8, -18.5, 2.3), (1.6, -8.6, 1.4), lens=32, dof=11.5, fstop=9)
    render("onboarding")


def shot_satellite(args):
    """Top-down 'satellite' tile: patchwork fields, hedgerows, gravel roads, fenced array — mock imagery."""
    setup_render(args.samples, (2048, 2048), args.preview)
    sky(sun_elev_deg=34, sun_rot_deg=-35, strength=0.35)
    bpy.context.scene.view_settings.exposure = -0.35
    coll = bpy.context.scene.collection
    ground(1500, "sat")
    rng = random.Random(11)
    gravel = br._principled("Gravel", br.srgb("#9d917c"), rough=0.95)
    pad = br._principled("Pad", br.srgb("#8f877a"), rough=0.9)
    br.box("road", (4.0, 400, 0.02), (-40, 0, 0.01), gravel, None, coll)
    br.box("road2", (200, 4.0, 0.02), (0, -34, 0.01), gravel, None, coll)
    br.box("spur", (4.0, 10, 0.02), (-30, -29, 0.01), gravel, None, coll)
    br.box("pad", (14, 10, 0.03), (-30, -26, 0.015), pad, None, coll)
    # inverter / storage containers on the pad
    cont = br._principled("Container", br.srgb("#dcdce2"), rough=0.4)
    for k in range(3):
        br.box(f"cont{k}", (2.4, 6.0, 2.6), (-34 + k * 3.4, -26, 1.3), cont, None, coll, bevel=0.05)
    br.box("cont_roof_copper", (2.4, 6.0, 0.05), (-27.2, -26, 2.62), br.materials()["copper"], None, coll)
    # fence line around the array
    fence = br._principled("Fence", br.srgb("#8a8a90"), metallic=1, rough=0.5)
    x0, x1, y0, y1 = -27, 25, -29, 31
    for (cx, cy, sx, sy) in (((x0 + x1) / 2, y0, x1 - x0, 0.12), ((x0 + x1) / 2, y1, x1 - x0, 0.12),
                             (x0, (y0 + y1) / 2, 0.12, y1 - y0), (x1, (y0 + y1) / 2, 0.12, y1 - y0)):
        br.box("fence", (sx, sy, 1.2), (cx, cy, 0.6), fence, None, coll)
    # hedgerows / trees along field boundaries
    leaves = [br._principled(f"Canopy{i}", br.srgb(c), rough=0.85)
              for i, c in enumerate(("#27331a", "#35431f", "#3f4a26", "#2c3a22"))]
    lines = [((-60, -70), (-60, 70)), ((45, -70), (45, 70)), ((-70, 52), (70, 52)), ((-70, -52), (70, -52))]
    for (a, b) in lines:
        for i in range(70):
            t = i / 69
            x = a[0] + (b[0] - a[0]) * t + rng.uniform(-1.5, 1.5)
            y = a[1] + (b[1] - a[1]) * t + rng.uniform(-1.5, 1.5)
            if rng.random() < 0.18:
                continue
            r = rng.uniform(1.4, 2.8)
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=r, location=(x, y, r * 0.8))
            o = bpy.context.active_object
            o.scale = (1, 1, 0.7)
            o.data.materials.append(rng.choice(leaves))
            bpy.ops.object.shade_smooth()
    robot_grid(22, 24, sx=2.0, sy=2.5, origin=(-24, -25), tilt=math.radians(35), az=math.radians(35))
    camera((0, 0, 300), (0, 0, 0), ortho=150)
    render("satellite")


# Site layouts mirror lib/sim/model.ts (rows, cols, pitchX, pitchY) so live map markers land on the robots.
SITES = {
    "mojave": dict(rows=16, cols=18, px=2.4, py=3.2, kind="desert", seed=1),
    "valley": dict(rows=10, cols=16, px=2.3, py=3.0, kind="grass", seed=2),
    "permian": dict(rows=12, cols=20, px=2.4, py=3.2, kind="desert", seed=3),
    "piedmont": dict(rows=8, cols=12, px=2.3, py=3.4, kind="sat", seed=4),
}
ORTHO_M = 110  # meters covered by each ortho tile (square)


def shot_ortho(args, site):
    """Transparent drone-ortho overlay of one site: robots, fence, pad + shadows (shadow catcher), no ground.
    The web map georeferences it: centre = site lat/lon, ORTHO_M metres square, north up."""
    cfg = SITES[site]
    setup_render(args.samples, (1536, 1536), args.preview)
    sc = bpy.context.scene
    sc.render.film_transparent = True
    sc.render.image_settings.color_mode = "RGBA"
    sky(sun_elev_deg=40, sun_rot_deg=-30, strength=0.35)
    sc.view_settings.exposure = -0.6
    coll = sc.collection
    g = ground(600, cfg["kind"])
    g.is_shadow_catcher = True
    w = cfg["cols"] * cfg["px"] + 12
    h = cfg["rows"] * cfg["py"] + 12
    gravel = br._principled("Gravel", br.srgb("#8d8270"), rough=0.95)
    fence = br._principled("Fence", br.srgb("#9a9aa0"), metallic=1, rough=0.45)
    for (cx, cy, sx, sy) in ((0, -h / 2, w, 0.12), (0, h / 2, w, 0.12), (-w / 2, 0, 0.12, h), (w / 2, 0, 0.12, h)):
        br.box("fence", (sx, sy, 1.2), (cx, cy, 0.6), fence, None, coll)
    br.box("service_lane", (w + 8, 3.5, 0.02), (0, -h / 2 - 4, 0.01), gravel, None, coll)
    pad = br._principled("Pad", br.srgb("#9c968c"), rough=0.9)
    br.box("pad", (10, 7, 0.03), (-w / 2 - 9, -h / 2 + 4, 0.015), pad, None, coll)
    cont = br._principled("Container", br.srgb("#dcdce2"), rough=0.4)
    br.box("inverter", (2.4, 6.0, 2.6), (-w / 2 - 9, -h / 2 + 4, 1.3), cont, None, coll, bevel=0.05)
    br.box("roof", (2.42, 6.02, 0.05), (-w / 2 - 9, -h / 2 + 4, 2.62), br.materials()["copper"], None, coll)
    # centred grid, row 0 at the north edge (matches the sim)
    robot_grid(cfg["rows"], cfg["cols"], sx=cfg["px"], sy=cfg["py"],
               origin=(-(cfg["cols"] - 1) / 2 * cfg["px"], -(cfg["rows"] - 1) / 2 * cfg["py"]),
               tilt=math.radians(35), az=math.radians(-60))
    camera((0, 0, 300), (0, 0, 0), ortho=ORTHO_M)
    render(f"ortho_{site}")


def shot_tracking(args):
    """Animated sun-tracking loop: sun sweeps E→W, panels follow."""
    setup_render(args.samples, (1920, 1080), args.preview)
    sc = bpy.context.scene
    frames = args.frames
    sc.frame_start, sc.frame_end = 1, frames
    s = sky(sun_elev_deg=10, sun_rot_deg=-90, strength=0.3)
    ground(600, "grass")
    grass_scatter(area=20, count=40000 if not args.preview else 8000)
    bots = []
    for k, (x, y) in enumerate(((0, 0), (-2.1, -2.6), (2.1, -2.6), (-4.2, -5.2), (0, -5.2), (4.2, -5.2))):
        rr = br.build_robot(f"T{k}", low=k > 0)
        rr.location = (x, y, 0)
        bots.append(rr)
    for f in range(1, frames + 1):
        t = (f - 1) / max(1, frames - 1)
        az = math.radians(-160 + 140 * t)  # sun sweeps across, front-lit from camera side
        el = math.radians(8 + 55 * math.sin(math.pi * t))
        s.sun_rotation = az
        s.sun_elevation = el
        s.keyframe_insert("sun_rotation", frame=f)
        s.keyframe_insert("sun_elevation", frame=f)
        for rr in bots:
            objs = br.pose(rr, tilt=(math.pi / 2 - el), azimuth=-az)
            objs["panel_tilt"].keyframe_insert("rotation_euler", frame=f)
            objs["panel_azimuth"].keyframe_insert("rotation_euler", frame=f)
    camera((5.5, 6.5, 2.2), (0, -1.2, 0.9), lens=35)
    os.makedirs(os.path.join(OUT, "tracking"), exist_ok=True)
    sc.render.filepath = os.path.join(OUT, "tracking", "f_")
    sc.render.image_settings.file_format = "JPEG"
    sc.render.image_settings.quality = 92
    bpy.ops.render.render(animation=True)


SHOTS = {
    "studio": shot_studio,
    "hero": shot_hero,
    "detail_sensor": shot_detail_sensor,
    "detail_wheel": shot_detail_wheel,
    "array": shot_array,
    "formation": shot_formation,
    "onboarding": shot_onboarding,
    "satellite": shot_satellite,
    "tracking": shot_tracking,
}


class Args:
    pass


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    a = Args()
    a.preview = "--preview" in argv
    a.samples = int(argv[argv.index("--samples") + 1]) if "--samples" in argv else 160
    a.frames = int(argv[argv.index("--frames") + 1]) if "--frames" in argv else 96
    for s in [x[len("ortho_"):] for x in argv if x.startswith("ortho_")]:
        br.clear_scene()
        shot_ortho(a, s)
    shots = [x for x in argv if x in SHOTS]
    if not shots and not any(x.startswith("ortho_") for x in argv):
        shots = ["studio"]
    for name in shots:
        br.clear_scene()
        SHOTS[name](a)
