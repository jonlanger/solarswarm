"""Design-review renders for the v2 robot (light product studio + exploded + line elevations).

  Blender -b -P blender/preview_v2.py -- <shot...> [--out DIR] [--samples N] [--preview]

Shots: front, rear, exploded, nose, wheel, utility, deck, fleet, mount, side, top, front_elev
Exploded also writes <out>/exploded_callouts.json (callout anchors in normalized image coords).
"""

import json
import math
import os
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Euler, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_robot as br  # noqa: E402
import render_scenes as rs  # noqa: E402
import solarbot_v2 as v2  # noqa: E402

A = {"out": os.path.join(HERE, "preview_v2"), "samples": 128, "preview": False}


def studio(cam_xy, floor_z=0.0, tone="#e9e8ec", floor_ext=None):
    """Seamless light cyclorama; the curved wall sits opposite the camera heading and the floor stops just
    short of the camera, so reflections toward the camera side fall on the dark world."""
    floor_ext = floor_ext or math.hypot(*cam_xy) * 0.8
    w = bpy.data.worlds.new("Studio")
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes["Background"]
    bg.inputs["Color"].default_value = (0.2, 0.2, 0.21, 1)
    bg.inputs["Strength"].default_value = 1.0
    # negative fill: glossy rays see a near-black world, so black glass and the PV stay deep
    lp = nt.nodes.new("ShaderNodeLightPath")
    dark = nt.nodes.new("ShaderNodeBackground")
    dark.inputs["Color"].default_value = (0.01, 0.01, 0.012, 1)
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Glossy Ray"], mix.inputs["Fac"])
    nt.links.new(bg.outputs["Background"], mix.inputs[1])
    nt.links.new(dark.outputs["Background"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], nt.nodes["World Output"].inputs["Surface"])
    # thin shell: inner (visible) surface out along floor/cove/wall, then back along a 2 cm offset
    def path(off):
        p = [(floor_ext, floor_z - 0.01 - off), (-4, floor_z - 0.01 - off)]
        for i in range(1, 25):
            a = (math.pi / 2) * i / 24
            p.append((-4 - (3 + off) * math.sin(a), floor_z + 3 - (3 + off) * math.cos(a)))
        return p + [(-7 - off, 12)]

    pts = path(0.0) + path(0.02)[::-1]
    v2.SC = bpy.context.scene.collection
    cyc = v2.extrude_x("cyc", pts, -14, 14)
    cyc.data.materials.append(br._principled("Cyc", br.srgb(tone), rough=0.7))
    bpy.context.view_layer.objects.active = cyc
    cyc.select_set(True)
    bpy.ops.object.shade_smooth()
    cyc.rotation_euler[2] = math.atan2(-cam_xy[0], cam_xy[1])
    return cyc


def lights(key_az=35, strength=1.0):
    def at(az, el, dist, size, power, color=(1, 1, 1)):
        a, e = math.radians(az), math.radians(el)
        loc = Vector((dist * math.cos(e) * math.sin(a), -dist * math.cos(e) * math.cos(a), dist * math.sin(e)))
        o = rs.area_light(f"L{az}", loc, Euler(), size, power * strength, color)
        rs.look_at(o, (0, 0, 0.6))
        return o

    at(key_az, 42, 4.5, 3.2, 1400, (1.0, 0.97, 0.94))       # key
    at(key_az - 110, 25, 4.0, 3.0, 420, (0.93, 0.95, 1.0))  # fill
    at(key_az + 150, 30, 4.0, 1.4, 900, (0.85, 0.8, 1.0))   # rim
    top = rs.area_light("top", (0, 0, 5), Euler(), 5, 260)
    top.visible_glossy = False  # keep the big softbox out of the panel glass


def setup(res):
    sc = rs.setup_render(A["samples"], res, A["preview"])
    sc.view_settings.look = "AgX - Base Contrast"
    sc.view_settings.exposure = -1.1
    return sc


def robot(tilt=0.4, az=0.0, mast=0.0, internal=False):
    r = v2.build()
    v2.pose(r, tilt=tilt, azimuth=az, mast=mast)
    v2.set_internal_visible(r, internal)
    return r


def cam(loc, target, lens=50, dof=None, fstop=4.0, ortho=None):
    return rs.camera(loc, target, lens=lens, dof=dof, fstop=fstop, ortho=ortho)


def save(name):
    os.makedirs(A["out"], exist_ok=True)
    sc = bpy.context.scene
    sc.render.filepath = os.path.join(A["out"], f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", sc.render.filepath)


def face_az(cam_xy, back=False):
    """Azimuth that turns the panel's face (or back) toward a camera position in plan."""
    x, y = cam_xy
    if back:
        x, y = -x, -y
    return math.atan2(x, -y)


# ---------------------------------------------------------------------------
def shot_front():
    setup((1800, 1500))
    c = (2.7, 3.1)
    studio(c)
    lights(key_az=160)
    robot(tilt=0.42, az=face_az(c))
    cam((c[0], c[1], 1.45), (0, 0, 0.66), lens=48, dof=4.0, fstop=8)
    save("front")


def shot_rear():
    setup((1800, 1500))
    c = (2.4, -2.7)
    studio(c)
    lights(key_az=-10)
    robot(tilt=0.95, az=face_az(c, back=True), mast=0.12)
    cam((c[0], c[1], 0.42), (0, 0, 0.92), lens=40, dof=3.6, fstop=8)
    save("rear")


def shot_exploded():
    setup((1500, 1900))
    c = (3.6, 3.9)
    studio(c, floor_z=-0.3)
    lights(key_az=160, strength=1.15)
    r = robot(tilt=0.0, az=0.0, internal=True)
    v2.explode(r)
    target = (0, 0.05, 1.12)
    cam((c[0], c[1], 3.5), target, lens=44)
    save("exploded")
    # callout anchors
    sc = bpy.context.scene
    names = {
        "panel_glass": "Cover glass",
        "panel_cells": "Back-contact cell laminate",
        "corner_11": "Frame extrusion + molded corner caps",
        "panel_backshell": "Ripple back shell",
        "hub_plate": "Mount hub + MPPT",
        "tilt_housing": "Tilt slew drive",
        "az_upper": "Azimuth slew drive",
        "mast_inner": "Telescoping mast",
        "gaiter_2": "Bellows seal + status ring",
        "gnss_F": "Dual RTK-GNSS antennas (panel corners)",
        "rail_R": "Roof rails: crew grab handles + lift slots",
        "hatch_main": "Service hatch (compute, fuses) + paddle latch",
        "cam_corner_FR": "Corner cameras (surround view)",
        "shell_upper": "Pearl upper shell",
        "led_wrap_front_R": "Wrap-around light signature",
        "mask_front": "Face mask: LiDAR, cameras, 3-projector lamps",
        "lidar_body": "Solid-state LiDAR + stereo cameras",
        "compute": "Compute module",
        "battery_cassette": "Drop-out battery cassette (swap from below)",
        "plinth": "Black plinth: bumpers, rub rib, belly",
        "arch_FR": "Rolled arch flare",
        "liner_FR": "Wheel-well liner + axle boot",
        "ultrasonic_front_3": "Ultrasonic array + flush recovery points",
        "hitch_plate": "Flush hitch receiver + dock contacts",
        "beam_F": "Oscillating drive beam",
        "stator_FR": "Hub motor",
        "tire_FR": "Block-tread tire + ripple rim",
    }
    out = []
    for n, label in names.items():
        o = bpy.data.objects.get(n)
        if not o:
            continue
        pts = [o.matrix_world @ Vector(b) for b in o.bound_box]
        ctr = sum(pts, Vector()) / 8
        p = world_to_camera_view(sc, sc.camera, ctr)
        out.append({"id": n, "label": label, "x": round(p.x, 4), "y": round(1 - p.y, 4)})
    with open(os.path.join(A["out"], "exploded_callouts.json"), "w") as f:
        json.dump(out, f, indent=1)


def shot_nose():
    setup((1600, 1100))
    c = (0.95, 1.75)
    studio(c)
    lights(key_az=150)
    robot(tilt=0.42, az=math.pi)
    cam((c[0], c[1], 0.52), (0.2, 0.62, 0.3), lens=55, dof=1.36, fstop=5.6)
    save("nose")


def shot_wheel():
    setup((1600, 1100))
    c = (1.45, 1.05)
    studio(c)
    lights(key_az=120)
    robot(tilt=0.42, az=math.pi)
    cam((c[0], c[1], 0.36), (0.42, 0.42, 0.24), lens=70, dof=1.2, fstop=5.6)
    save("wheel")


def shot_utility():
    """Rear three-quarter, low: hitch, recovery eyes, dock contacts, tail brackets."""
    setup((1600, 1100))
    c = (-1.2, -1.75)
    studio(c)
    lights(key_az=-20)
    robot(tilt=0.0, az=0.0, mast=-0.18)
    cam((c[0], c[1], 0.5), (-0.12, -0.62, 0.26), lens=50, dof=1.5, fstop=5.6)
    save("utility")


def shot_deck():
    """High rear three-quarter over the platform: maintenance hatch + paddle latch, e-stops, rails, deck mark."""
    setup((1600, 1100))
    c = (-1.0, -1.45)
    studio(c)
    lights(key_az=-30)
    robot(tilt=1.1, az=math.pi / 2, mast=0.25)
    cam((c[0], c[1], 1.25), (0.0, -0.12, 0.42), lens=45, dof=1.75, fstop=5.6)
    save("deck")


def shot_fleet():
    """Three units parked shoulder to shoulder, panels stowed flat: the panel width sets the 1.03 m pitch."""
    setup((2000, 1200))
    c = (3.4, 4.2)
    studio(c, floor_ext=6.0)
    lights(key_az=160)
    for i, x in enumerate((-1.03, 0.0, 1.03)):
        r = v2.build(name=f"SolarBot_{i}")
        v2.pose(r, tilt=0.0, azimuth=0.0, mast=-0.18)
        v2.set_internal_visible(r, False)
        r.location.x = x
    cam((c[0], c[1], 2.1), (0.0, 0.1, 0.45), lens=40, dof=5.2, fstop=11)
    save("fleet")


def shot_mount():
    setup((1600, 1100))
    c = (1.25, -1.35)
    studio(c)
    lights(key_az=-20)
    robot(tilt=0.95, az=face_az(c, back=True), mast=0.12)
    cam((c[0], c[1], 0.78), (0, 0, 1.34), lens=50, dof=1.7, fstop=5.6)
    save("mount")


def _lineart(res, ortho, loc, target):
    sc = setup(res)
    sc.cycles.samples = 16
    sc.view_settings.look = "None"
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.exposure = 0.0
    w = bpy.data.worlds.new("White")
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
    clay = bpy.data.materials.new("Clay")
    clay.use_nodes = True
    b = clay.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.92, 0.92, 0.93, 1)
    b.inputs["Roughness"].default_value = 0.9
    sc.view_layers[0].material_override = clay
    sc.render.use_freestyle = True
    sc.render.line_thickness_mode = "ABSOLUTE"
    sc.render.line_thickness = 1.1
    fs = sc.view_layers[0].freestyle_settings
    fs.crease_angle = math.radians(140)
    ls = fs.linesets[0]
    ls.select_by_visibility = True
    ls.visibility = "VISIBLE"
    ls.select_crease = True
    ls.select_border = True
    ls.select_silhouette = True
    if ls.linestyle is None:  # background mode doesn't create the default linestyle
        ls.linestyle = bpy.data.linestyles.new("Line")
    ls.linestyle.color = (0.08, 0.08, 0.1)
    rs.area_light("sun", (2, -3, 5), Euler(), 6, 300)
    cam(loc, target, ortho=ortho)


def shot_side():
    robot(tilt=0.0, az=0.0)
    _lineart((2000, 1300), 2.3, (6, 0, 0.75), (0, 0, 0.75))
    save("side")


def shot_top():
    robot(tilt=0.0, az=0.0)
    for n in ("panel_glass", "panel_cells", "panel_backshell", "frame_L", "frame_R", "frame_F", "frame_B",
              "corner_11", "corner_1-1", "corner_-11", "corner_-1-1"):
        o = bpy.data.objects.get(n)
        if o:
            o.hide_render = True
    _lineart((1300, 1600), 1.62, (0, 0.0001, 6), (0, 0, 0))
    save("top")


def shot_front_elev():
    robot(tilt=0.0, az=0.0)
    _lineart((1300, 1300), 1.9, (0, 6, 0.75), (0, 0, 0.75))
    save("front_elev")


SHOTS = {k[5:]: v for k, v in globals().items() if k.startswith("shot_")}

if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if "--out" in argv:
        A["out"] = argv[argv.index("--out") + 1]
    if "--samples" in argv:
        A["samples"] = int(argv[argv.index("--samples") + 1])
    A["preview"] = "--preview" in argv
    for s in [x for x in argv if x in SHOTS] or ["front"]:
        br.clear_scene()
        SHOTS[s]()
