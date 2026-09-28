"""SolarSwarm mark: three strokes — the panel at 45°, the mast, the base. A sun tracker reduced to a line drawing.

One source of truth for the mark. Running this file with plain Python writes the SVGs used by the web apps
(public/brand/, app/icon.svg); the Blender scripts import `polygons()` to build the same strokes as decals.

    python3 blender/logo.py

32 x 32 grid (y down, like SVG), one stroke weight, round caps:
  panel  45° stroke, balanced on the top of the mast — the only colored stroke (swarm violet): it makes the energy
  mast   vertical
  base   horizontal, the robot on the ground
"""

import math
import os

W = 3.4                                   # stroke weight
PANEL = ((9.0, 20.0), (23.0, 6.0))        # 45°, centered on the mast top
MAST = ((16.0, 13.0), (16.0, 25.5))
BASE = ((5.0, 25.5), (27.0, 25.5))
VIOLET = ("#2a0e61", "#5b2bd9", "#9d6bff")  # --grad-swarm stops
VIOLET_ON_DARK = ("#5b2bd9", "#9d6bff", "#bb97ff")  # lifted so the low end still reads on dark grounds


def svg(mode="color"):
    """mode: 'color' (violet panel, ink strokes), 'mono' (currentColor), 'inverse' (violet panel, white strokes)."""
    ink = {"color": "#15131c", "mono": "currentColor", "inverse": "#ffffff"}[mode]
    (px0, py0), (px1, py1) = PANEL
    stops = VIOLET_ON_DARK if mode == "inverse" else VIOLET
    panel_stroke = "currentColor" if mode == "mono" else "url(#ss-panel)"
    defs = "" if mode == "mono" else (
        f'<defs><linearGradient id="ss-panel" gradientUnits="userSpaceOnUse" x1="{px0}" y1="{py0}" x2="{px1}" y2="{py1}">'
        f'<stop offset="0" stop-color="{stops[0]}"/><stop offset="0.55" stop-color="{stops[1]}"/>'
        f'<stop offset="1" stop-color="{stops[2]}"/></linearGradient></defs>')

    def line(a, b, stroke):
        return f'<line x1="{a[0]}" y1="{a[1]}" x2="{b[0]}" y2="{b[1]}" stroke="{stroke}"/>'

    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke-width="{W}" '
            f'stroke-linecap="round">{defs}{line(*BASE, ink)}{line(*MAST, ink)}{line(*PANEL, panel_stroke)}</svg>\n')


def _capsule(a, b, r, k=10):
    """Stadium polygon around segment a-b (CCW in a y-up frame)."""
    (ax, ay), (bx, by) = a, b
    ang = math.atan2(by - ay, bx - ax)
    pts = []
    for cx, cy, a0 in ((bx, by, ang - math.pi / 2), (ax, ay, ang + math.pi / 2)):
        for i in range(k + 1):
            t = a0 + math.pi * i / k
            pts.append((cx + r * math.cos(t), cy + r * math.sin(t)))
    return pts


def polygons(k=10):
    """[(role, [(x, y), ...])] in a y-up frame centered on the mark; 1 unit = 1/32 of the mark's box."""
    def up(p):
        return (p[0] - 16.0, 16.0 - p[1])

    return [("ink", _capsule(up(BASE[0]), up(BASE[1]), W / 2, k)),
            ("ink", _capsule(up(MAST[0]), up(MAST[1]), W / 2, k)),
            ("panel", _capsule(up(PANEL[0]), up(PANEL[1]), W / 2, k))]


# decal width reference (callers pass a physical width for the mark's full extent)
EXTENT = BASE[1][0] - BASE[0][0] + W


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.join(here, "..", "public", "brand")
    os.makedirs(root, exist_ok=True)
    for mode in ("color", "mono", "inverse"):
        with open(os.path.join(root, f"solarswarm-mark-{mode}.svg"), "w") as f:
            f.write(svg(mode))
    with open(os.path.join(here, "..", "app", "icon.svg"), "w") as f:
        f.write(svg("color"))
    print("wrote", os.path.normpath(root), "and app/icon.svg")
