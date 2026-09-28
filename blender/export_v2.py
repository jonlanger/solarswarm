"""Export the v2 robot for the web: public/models/solarbot.glb (hero / viewer) and solarbot_lod.glb (swarms).

  Blender -b -P blender/export_v2.py

Web contract (components/three/Robot.tsx, Swarm.tsx): rig nodes SolarBot, wheel_FL/FR/RL/RR, mast_height,
panel_azimuth, panel_tilt, and the LED_Front / LED_Rear / LED_Status materials. Swarm draws one InstancedMesh
per mesh, so parts are merged per (rig node, material): a few dozen draw calls instead of hundreds.
LOD also drops sub-3 cm hardware (screws, lens rings, ultrasonic discs) and decimates the dense surfaces.
"""

import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_robot as br  # noqa: E402
import solarbot_v2 as v2  # noqa: E402

KEEP_SMALL = ("led", "estop", "status", "gnss", "light_side", "cam_corner", "mark_")


def flatten(o):
    if o.type == "MESH" and o.modifiers:
        v2.apply_mods(o)


def size(o):
    """Bounding-box diagonal (m), in world scale."""
    pts = [o.matrix_world @ Vector(b) for b in o.bound_box]
    return (Vector([max(p[i] for p in pts) for i in range(3)]) - Vector([min(p[i] for p in pts) for i in range(3)])).length


def decimate(o, ratio):
    m = o.modifiers.new("dec", "DECIMATE")
    m.ratio = ratio
    v2.apply_mods(o)


def web_materials():
    """Realtime-safe materials.
    - anisotropy off: three.js builds the anisotropy tangent frame from UVs, and the procedural v2 parts have none,
      so it evaluates to NaN — and bloom/AO then smear that NaN across the whole frame (black canvas).
    - transmission off (no refraction pass); glazing becomes a thin alpha-blended coat."""
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        b = m.node_tree.nodes.get("Principled BSDF")
        if b and b.inputs["Anisotropic"].default_value > 0:
            b.inputs["Anisotropic"].default_value = 0.0
        if b and b.inputs["Transmission Weight"].default_value > 0:
            b.inputs["Transmission Weight"].default_value = 0.0
            b.inputs["Base Color"].default_value = (0.02, 0.02, 0.025, 1)
            b.inputs["Alpha"].default_value = 0.18
            m.blend_method = "BLEND"


def optimize(root, low):
    for o in list(root.children_recursive):
        # internals, plus structure fully enclosed by the body (only seen in the exploded view)
        if o.get("internal") or o.name.startswith(("_", "beam_", "pivot_")):
            bpy.data.objects.remove(o)
    meshes = [o for o in root.children_recursive if o.type == "MESH"]
    for o in meshes:
        flatten(o)
    if low:
        for o in list(meshes):
            if size(o) < 0.03 and not any(k in o.name for k in KEEP_SMALL):
                meshes.remove(o)
                bpy.data.objects.remove(o)
    # triangle budget per part: the pearl shell and plinth carry the design, so they keep the most
    for o in meshes:
        t = sum(len(p.vertices) - 2 for p in o.data.polygons)
        cap = (3200 if o.name.startswith(("shell_upper", "plinth")) else 700) if low else \
              (30000 if o.name.startswith(("shell_upper", "plinth", "panel_backshell")) else 7000)
        if t > cap:
            decimate(o, max(cap / t, 0.08))
    # merge per (rig node, material)
    groups = {}
    for o in meshes:
        groups.setdefault((o.parent.name, o.data.materials[0].name), []).append(o)
    for (parent, mat), objs in groups.items():
        if len(objs) < 2:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
        objs[0].name = f"{parent}__{mat}"
    if low:  # second pass on the merged meshes: a hard budget per draw call
        for o in [o for o in root.children_recursive if o.type == "MESH"]:
            t = sum(len(p.vertices) - 2 for p in o.data.polygons)
            cap = 3500 if ("Deck_Pearl" in o.name or "Cladding" in o.name) else 900
            if t > cap:
                decimate(o, max(cap / t, 0.05))
    n = sum(1 for o in root.children_recursive if o.type == "MESH")
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in root.children_recursive if o.type == "MESH")
    return n, tris


if __name__ == "__main__":
    web = dict(backshell_step=0.014, ripple=True, tire_n=4, knurl=True, rim_n=72, rim_prof=30)
    swarm = dict(backshell_step=0.06, ripple=False, tire_n=1, knurl=False, rim_n=32, rim_prof=8)
    for low, fname in ((False, "solarbot.glb"), (True, "solarbot_lod.glb")):
        v2.Q.update(swarm if low else web)
        br.clear_scene()
        root = v2.build()
        v2.pose(root)
        n, tris = optimize(root, low)
        web_materials()
        path = os.path.join(os.environ.get("SS_EXPORT_DIR", os.path.join(br.ROOT, "public", "models")), fname)
        br.export_glb(path, root, draco=os.environ.get("SS_NO_DRACO") is None)
        print("EXPORTED", fname, f"{n} meshes, {tris} tris, {os.path.getsize(path) / 1e6:.2f} MB")
