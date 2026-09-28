"""SolarSwarm robot: procedural model + rig.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/build_robot.py -- [--low]

Rig nodes (names are the contract with the web app — see components/three/Robot.tsx):
  SolarBot            root (forward = +Y in Blender → -Z in glTF)
  wheel_FL/FR/RL/RR   rotate about local X to roll
  mast_height         translate local Z (0 → 0.25 m) to raise the panel
  panel_azimuth       rotate about local Z
  panel_tilt          rotate about local X (0 = flat, +/- ~1.05 rad)
  led_front / led_rear / status_ring   emissive meshes (materials LED_*)
"""

import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

TEX_DIR = os.path.join(ROOT, "public", "models", "textures")

# ---------------------------------------------------------------------------
# Dimensions (meters)
# ---------------------------------------------------------------------------
BODY_L, BODY_W, BODY_H = 1.12, 0.62, 0.2
BODY_Z = 0.15  # bottom of body
WHEEL_R, WHEEL_W = 0.17, 0.11
WHEEL_X, WHEEL_Y = 0.43, 0.40
MAST_BASE_Z = BODY_Z + BODY_H
MAST_OUTER_TOP = 0.9
PANEL_W, PANEL_L, PANEL_T = 1.0, 1.65, 0.035


# ---------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------
def _principled(name, color, metallic=0.0, rough=0.5, coat=0.0, coat_rough=0.05, **extra):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = coat_rough
    for k, v in extra.items():
        b.inputs[k].default_value = v
    return m


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def materials():
    M = {}
    M["body"] = _principled("Body_Graphite", srgb("#141318"), rough=0.5, coat=0.15, coat_rough=0.3)
    M["deck"] = _principled("Deck_Pearl", srgb("#d9d6de"), rough=0.35, coat=0.4, coat_rough=0.12)
    M["trim"] = _principled("Trim_Black", srgb("#0d0d10"), rough=0.6)
    M["rubber"] = _principled("Tire_Rubber", srgb("#0b0b0c"), rough=0.9)
    M["alu"] = _principled("Aluminum_Brushed", srgb("#c9cbd1"), metallic=1.0, rough=0.28, **{"Anisotropic": 0.5})
    M["alu_dark"] = _principled("Aluminum_Anodized", srgb("#2c2c33"), metallic=1.0, rough=0.34)
    M["copper"] = _principled("Copper", (0.955, 0.52, 0.33), metallic=1.0, rough=0.24)
    M["glass_dark"] = _principled("Sensor_Glass", srgb("#050508"), rough=0.04, coat=1.0, coat_rough=0.01)
    M["led_front"] = _principled(
        "LED_Front", srgb("#b99aff"), rough=0.3,
        **{"Emission Color": (*srgb("#9d6bff"), 1.0), "Emission Strength": 8.0},
    )
    M["led_rear"] = _principled(
        "LED_Rear", srgb("#f0b27a"), rough=0.3,
        **{"Emission Color": (*srgb("#e0a36a"), 1.0), "Emission Strength": 5.0},
    )
    M["status"] = _principled(
        "LED_Status", srgb("#b99aff"), rough=0.3,
        **{"Emission Color": (*srgb("#9d6bff"), 1.0), "Emission Strength": 4.0},
    )
    M["vent"] = _principled("Vent_Dark", srgb("#08080a"), rough=0.7)

    # Photovoltaic glass: cell albedo texture + glossy coat
    pv = bpy.data.materials.get("PV_Cells")
    if not pv:
        tex_path = os.path.join(TEX_DIR, "panel_cells.png")
        if not os.path.exists(tex_path):
            from textures import make_panel_albedo

            make_panel_albedo(tex_path)
        pv = _principled("PV_Cells", (0.02, 0.02, 0.04), rough=0.1, coat=1.0, coat_rough=0.02,
                         **{"Specular IOR Level": 0.6})
        nt = pv.node_tree
        img = nt.nodes.new("ShaderNodeTexImage")
        img.image = bpy.data.images.load(tex_path, check_existing=True)
        img.interpolation = "Cubic"
        nt.links.new(img.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
    M["pv"] = pv
    M["backsheet"] = _principled("PV_Backsheet", srgb("#e6e5ea"), rough=0.55)
    return M


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------
def _link(obj, coll):
    for c in obj.users_collection:
        c.objects.unlink(obj)
    coll.objects.link(obj)


def _finish(obj, mat, parent, coll, smooth=True, bevel=None, segments=4, name=None):
    if name:
        obj.name = name
        obj.data.name = name
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
        mod.harden_normals = True
    if smooth:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        try:
            bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
        except Exception:
            bpy.ops.object.shade_smooth()
        obj.select_set(False)
    if parent is not None:
        mw = obj.matrix_world.copy()
        obj.parent = parent
        obj.matrix_world = mw
    _link(obj, coll)
    return obj


def box(name, size, loc, mat, parent, coll, bevel=0.0, segments=4):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(o, mat, parent, coll, bevel=bevel or None, segments=segments, name=name)


def cyl(name, r, depth, loc, mat, parent, coll, axis="Z", verts=48, bevel=0.0, segments=3):
    rot = {"Z": (0, 0, 0), "X": (0, math.pi / 2, 0), "Y": (math.pi / 2, 0, 0)}[axis]
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return _finish(o, mat, parent, coll, bevel=bevel or None, segments=segments, name=name)


def empty(name, loc, parent, coll):
    o = bpy.data.objects.new(name, None)
    o.empty_display_type = "PLAIN_AXES"
    o.empty_display_size = 0.1
    o.location = loc
    coll.objects.link(o)
    if parent is not None:
        o.parent = parent
        o.location = Vector(loc) - parent.matrix_world.translation
    bpy.context.view_layer.update()
    return o


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    for o in objs:
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    o.data.name = name
    o.select_set(False)
    return o


# ---------------------------------------------------------------------------
# Robot
# ---------------------------------------------------------------------------
def build_wheel(tag, x, y, parent, coll, M, low=False):
    side = 1 if x > 0 else -1
    wz = WHEEL_R
    w = empty(f"wheel_{tag}", (x, y, wz), parent, coll)
    verts = 32 if low else 64
    tire = cyl(f"tire_{tag}", WHEEL_R - 0.014, WHEEL_W, (x, y, wz), M["rubber"], None, coll,
               axis="X", verts=verts, bevel=0.042, segments=3 if low else 6)
    parts = [tire]
    if not low:
        # directional chevron tread lugs
        n = 34
        for i in range(n):
            a = 2 * math.pi * i / n
            for k, off in enumerate((-0.026, 0.026)):
                aa = a + (math.pi / n if k else 0)
                r = WHEEL_R - 0.008
                bpy.ops.mesh.primitive_cube_add(size=1, location=(x + off, y + r * math.sin(aa), wz + r * math.cos(aa)))
                lug = bpy.context.active_object
                lug.scale = (0.044, 0.024, 0.014)
                lug.rotation_mode = "ZYX"  # yaw (chevron) first, then roll onto the radius
                lug.rotation_euler = (-aa, 0, (0.38 if k else -0.38))
                bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
                m = lug.modifiers.new("b", "BEVEL")
                m.width = 0.005
                m.segments = 3
                parts.append(lug)
        # sidewall bead rings
        for sx in (-1, 1):
            bpy.ops.mesh.primitive_torus_add(major_radius=WHEEL_R * 0.78, minor_radius=0.006,
                                             major_segments=verts, minor_segments=8,
                                             location=(x + sx * (WHEEL_W / 2 - 0.004), y, wz),
                                             rotation=(0, math.pi / 2, 0))
            parts.append(bpy.context.active_object)
        tire = join(parts, f"tire_{tag}")
        tire.data.materials.clear()
        tire.data.materials.append(M["rubber"])
        bpy.context.view_layer.objects.active = tire
        tire.select_set(True)
        bpy.ops.object.shade_smooth()
        tire.select_set(False)
    tire.parent = w
    tire.matrix_parent_inverse = w.matrix_world.inverted()

    face_x = x + side * (WHEEL_W / 2)
    cyl(f"rim_{tag}", WHEEL_R * 0.62, WHEEL_W - 0.01, (x, y, wz), M["alu_dark"], w, coll,
        axis="X", verts=verts, bevel=0.006)
    cyl(f"rimface_{tag}", WHEEL_R * 0.56, WHEEL_W + 0.004, (x, y, wz), M["trim"], w, coll, axis="X", verts=verts)
    if not low:
        bpy.ops.mesh.primitive_torus_add(major_radius=WHEEL_R * 0.59, minor_radius=0.011, major_segments=verts,
                                         minor_segments=12, location=(face_x + side * 0.002, y, wz),
                                         rotation=(0, math.pi / 2, 0))
        _finish(bpy.context.active_object, M["alu"], w, coll, name=f"rimlip_{tag}")
        for i in range(6):
            a = 2 * math.pi * i / 6
            sp = box(f"spoke_{tag}_{i}", (0.02, 0.026, WHEEL_R * 0.4),
                     (face_x + side * 0.004, y + 0.06 * math.sin(a), wz + 0.06 * math.cos(a)),
                     M["alu"], w, coll, bevel=0.007, segments=3)
            sp.rotation_euler = (-a, 0, 0)
    cyl(f"hub_{tag}", 0.042, WHEEL_W + 0.03, (x, y, wz), M["copper"], w, coll, axis="X", verts=verts,
        bevel=0.014, segments=5)
    # motor pod bridging wheel to body
    pod_x = x - side * (WHEEL_W / 2 + 0.05)
    cyl(f"motor_{tag}", 0.068, 0.1, (pod_x, y, wz), M["body"], parent, coll, axis="X", verts=verts // 2,
        bevel=0.012)
    return w


def build_robot(name="SolarBot", low=False, coll=None, location=(0, 0, 0)):
    coll = coll or bpy.context.scene.collection
    M = materials()
    root = bpy.data.objects.new(name, None)
    root.empty_display_type = "ARROWS"
    coll.objects.link(root)

    # ---- chassis ----
    bz = BODY_Z + BODY_H / 2
    box("body", (BODY_W, BODY_L, BODY_H), (0, 0, bz), M["body"], root, coll, bevel=0.06,
        segments=3 if low else 8)
    box("deck", (BODY_W - 0.07, BODY_L - 0.12, 0.03), (0, -0.02, BODY_Z + BODY_H + 0.006), M["deck"], root,
        coll, bevel=0.012, segments=4)
    # skirt / bumper line
    box("bumper_front", (BODY_W - 0.08, 0.05, 0.06), (0, BODY_L / 2 - 0.005, BODY_Z + 0.05), M["trim"], root,
        coll, bevel=0.02)
    box("bumper_rear", (BODY_W - 0.08, 0.05, 0.06), (0, -BODY_L / 2 + 0.005, BODY_Z + 0.05), M["trim"], root,
        coll, bevel=0.02)

    # LED light bars (front purple, rear copper-amber)
    box("led_front", (BODY_W * 0.62, 0.012, 0.022), (0, BODY_L / 2 + 0.001, BODY_Z + BODY_H * 0.62),
        M["led_front"], root, coll, bevel=0.006)
    box("led_rear", (BODY_W * 0.4, 0.012, 0.018), (0, -BODY_L / 2 - 0.001, BODY_Z + BODY_H * 0.62),
        M["led_rear"], root, coll, bevel=0.005)

    if not low:
        # stereo cameras flanking LED bar
        for sx in (-1, 1):
            cz = BODY_Z + BODY_H * 0.62
            cyl(f"camera_bezel_{sx}", 0.03, 0.02, (sx * BODY_W * 0.38, BODY_L / 2 + 0.004, cz), M["alu"], root,
                coll, axis="Y", verts=48, bevel=0.005)
            cyl(f"camera_{'L' if sx < 0 else 'R'}", 0.02, 0.022, (sx * BODY_W * 0.38, BODY_L / 2 + 0.01, cz),
                M["glass_dark"], root, coll, axis="Y", verts=48, bevel=0.003)
        # side vents
        for sx in (-1, 1):
            for i in range(7):
                box(f"vent_{sx}_{i}", (0.01, 0.018, 0.07),
                    (sx * (BODY_W / 2 + 0.001), -0.18 + i * 0.06, BODY_Z + BODY_H * 0.5), M["vent"], root, coll,
                    bevel=0.004)
        # docking contacts (rear)
        for sx in (-1, 1):
            box(f"dock_{sx}", (0.07, 0.01, 0.03), (sx * 0.12, -BODY_L / 2 - 0.004, BODY_Z + 0.1), M["copper"],
                root, coll, bevel=0.004)
        # LiDAR puck
        lz = BODY_Z + BODY_H + 0.02
        cyl("lidar_base", 0.05, 0.03, (0, BODY_L / 2 - 0.12, lz + 0.015), M["body"], root, coll, verts=48,
            bevel=0.008)
        cyl("lidar_window", 0.046, 0.035, (0, BODY_L / 2 - 0.12, lz + 0.045), M["glass_dark"], root, coll,
            verts=48)
        cyl("lidar_cap", 0.05, 0.015, (0, BODY_L / 2 - 0.12, lz + 0.07), M["body"], root, coll, verts=48,
            bevel=0.006)
        # GNSS dome
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.045, location=(0, -BODY_L / 2 + 0.14, lz), segments=32,
                                             ring_count=16)
        g = bpy.context.active_object
        g.scale = (1, 1, 0.55)
        bpy.ops.object.transform_apply(scale=True)
        _finish(g, M["deck"], root, coll, name="gnss")

    # wheels
    for tag, sx, sy in (("FL", -1, 1), ("FR", 1, 1), ("RL", -1, -1), ("RR", 1, -1)):
        build_wheel(tag, sx * WHEEL_X, sy * WHEEL_Y, root, coll, M, low=low)

    # ---- mast ----
    top = BODY_Z + BODY_H + 0.02
    cyl("status_ring", 0.1, 0.012, (0, 0, top + 0.004), M["status"], root, coll, verts=64)
    cyl("mast_collar", 0.085, 0.05, (0, 0, top + 0.03), M["copper"], root, coll, verts=64, bevel=0.01)
    outer_len = MAST_OUTER_TOP - (top + 0.05)
    cyl("mast_outer", 0.06, outer_len, (0, 0, top + 0.05 + outer_len / 2), M["body"], root, coll, verts=48,
        bevel=0.01)
    cyl("mast_seal", 0.064, 0.018, (0, 0, MAST_OUTER_TOP), M["trim"], root, coll, verts=48, bevel=0.005)

    mh = empty("mast_height", (0, 0, MAST_OUTER_TOP), root, coll)
    inner_len = 0.3
    cyl("mast_inner", 0.045, inner_len, (0, 0, MAST_OUTER_TOP + inner_len / 2 - 0.02), M["alu"], mh, coll,
        verts=48)

    az_z = MAST_OUTER_TOP + inner_len - 0.02
    az = empty("panel_azimuth", (0, 0, az_z), mh, coll)
    cyl("turntable", 0.075, 0.045, (0, 0, az_z + 0.02), M["body"], az, coll, verts=48, bevel=0.01)
    cyl("turntable_ring", 0.078, 0.01, (0, 0, az_z + 0.005), M["copper"], az, coll, verts=48)
    for sx in (-1, 1):
        box(f"yoke_{sx}", (0.022, 0.09, 0.12), (sx * 0.1, 0, az_z + 0.1), M["alu_dark"], az, coll, bevel=0.008)
    box("yoke_base", (0.24, 0.09, 0.022), (0, 0, az_z + 0.045), M["alu_dark"], az, coll, bevel=0.006)

    tilt_z = az_z + 0.13
    tilt = empty("panel_tilt", (0, 0, tilt_z), az, coll)
    cyl("hinge", 0.026, 0.25, (0, 0, tilt_z), M["alu"], tilt, coll, axis="X", verts=32, bevel=0.004)
    for sx in (-1, 1):
        cyl(f"hinge_cap_{sx}", 0.03, 0.012, (sx * 0.12, 0, tilt_z), M["copper"], tilt, coll, axis="X", verts=32)
    # support rails
    pz = tilt_z + 0.07
    box("crossbeam", (0.62, 0.06, 0.035), (0, 0, tilt_z + 0.035), M["alu_dark"], tilt, coll, bevel=0.006)
    for sx in (-1, 1):
        box(f"rail_{sx}", (0.045, PANEL_L * 0.86, 0.03), (sx * 0.28, 0, pz - 0.025), M["alu"], tilt, coll,
            bevel=0.006)

    # panel
    box("panel_frame", (PANEL_W, PANEL_L, PANEL_T), (0, 0, pz), M["alu_dark"], tilt, coll, bevel=0.006,
        segments=3)
    box("panel_trim", (PANEL_W + 0.006, PANEL_L + 0.006, 0.006), (0, 0, pz + 0.002), M["copper"], tilt, coll,
        bevel=0.002, segments=2)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, pz + PANEL_T / 2 + 0.0008))
    glass = bpy.context.active_object
    glass.scale = (PANEL_W - 0.03, PANEL_L - 0.03, 1)
    bpy.ops.object.transform_apply(scale=True)
    _finish(glass, M["pv"], tilt, coll, smooth=False, name="panel_cells")
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, pz - PANEL_T / 2 - 0.0008), rotation=(math.pi, 0, 0))
    back = bpy.context.active_object
    back.scale = (PANEL_W - 0.03, PANEL_L - 0.03, 1)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    _finish(back, M["backsheet"], tilt, coll, smooth=False, name="panel_back")
    if not low:
        # junction box
        box("junction_box", (0.14, 0.1, 0.022), (0, PANEL_L * 0.36, pz - PANEL_T / 2 - 0.011), M["trim"], tilt,
            coll, bevel=0.004)
        for sx in (-1, 1):
            box(f"panel_corner_{sx}_f", (0.05, 0.05, PANEL_T + 0.008),
                (sx * (PANEL_W / 2 - 0.02), PANEL_L / 2 - 0.02, pz), M["copper"], tilt, coll, bevel=0.006)
            box(f"panel_corner_{sx}_r", (0.05, 0.05, PANEL_T + 0.008),
                (sx * (PANEL_W / 2 - 0.02), -PANEL_L / 2 + 0.02, pz), M["copper"], tilt, coll, bevel=0.006)

    root.location = location
    return root


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def export_glb(path, root, draco=True):
    bpy.ops.object.select_all(action="DESELECT")

    def sel(o):
        o.select_set(True)
        for c in o.children:
            sel(c)

    sel(root)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_image_format="JPEG",
        export_jpeg_quality=88,
        export_extras=False,
        export_animations=False,
        export_lights=False,
        export_cameras=False,
        # web decodes with the self-hosted decoder in public/draco (components/three/assets.ts)
        export_draco_mesh_compression_enable=draco,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )


def pose(root, tilt=0.0, azimuth=0.0, mast=0.0):
    objs = {o.name.split(".")[0]: o for o in root.children_recursive}
    objs["panel_tilt"].rotation_euler[0] = tilt
    objs["panel_azimuth"].rotation_euler[2] = azimuth
    objs["mast_height"].location[2] = MAST_OUTER_TOP + mast
    return objs


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    low = "--low" in argv
    clear_scene()
    r = build_robot(low=low)
    out = os.path.join(ROOT, "public", "models", "solarbot_lod.glb" if low else "solarbot.glb")
    export_glb(out, r)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "solarbot_lod.blend" if low else "solarbot.blend"))
    print("EXPORTED", out, os.path.getsize(out))
