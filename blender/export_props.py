"""Export the delivery truck and onboarding portal as GLBs for the web scenes.

  Blender -b -P blender/export_props.py
"""

import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_robot as br  # noqa: E402
import render_scenes as rs  # noqa: E402

for name, make in (("truck", lambda: rs.flatbed_truck()), ("portal", lambda: rs.portal())):
    br.clear_scene()
    root = make()
    root.name = name
    br.export_glb(os.path.join(br.ROOT, "public", "models", f"{name}.glb"), root)
    print("EXPORTED", name)
