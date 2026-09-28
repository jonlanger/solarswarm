"""Export the transporter truck and pairing portal as GLBs for the web scenes (delegates to props_v2).

  Blender -b -P blender/export_props.py
"""

import os
import runpy

runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), "props_v2.py"), run_name="__main__")
