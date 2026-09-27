"""Procedural textures for the SolarSwarm robot (runs inside Blender's Python, uses numpy).

Generates a 60-cell (6 x 10) monocrystalline panel albedo: pseudo-square cells with
chamfered corners, violet-indigo AR tint, silver busbars and faint fingers on a white
backsheet. Written as PNG so both Cycles and the glTF export share it.
"""

import os
import numpy as np

PX_PER_M = 1100
PANEL_W = 1.0   # meters (X)
PANEL_L = 1.65  # meters (Y)
COLS, ROWS = 6, 10


def _hex(h):
    h = h.lstrip("#")
    return np.array([int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4)])


def make_panel_albedo(path, seed=7, style="classic"):
    """style: 'classic' (white backsheet) or 'black' (all-black premium panel)."""
    rng = np.random.default_rng(seed)
    W = int(PANEL_W * PX_PER_M)
    H = int(PANEL_L * PX_PER_M)
    back = _hex("#d9dade") if style == "classic" else _hex("#0c0b10")
    img = np.ones((H, W, 3)) * back

    margin = 0.028 * PX_PER_M
    gap = 0.0035 * PX_PER_M
    cell_w = (W - 2 * margin - (COLS - 1) * gap) / COLS
    cell_h = (H - 2 * margin - (ROWS - 1) * gap) / ROWS
    chamfer = 0.12 * cell_w

    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

    base = _hex("#16112c")
    sheen = _hex("#2c2360")

    # Low-frequency crystalline mottling shared across the panel.
    noise = rng.normal(0, 1, (H // 32 + 2, W // 32 + 2))
    noise = np.kron(noise, np.ones((32, 32)))[:H, :W]
    k = np.ones(9) / 9
    noise = np.apply_along_axis(lambda r: np.convolve(r, k, "same"), 1, noise)
    noise = np.apply_along_axis(lambda c: np.convolve(c, k, "same"), 0, noise)
    noise = (noise - noise.min()) / (np.ptp(noise) + 1e-6)

    for r in range(ROWS):
        for c in range(COLS):
            x0 = margin + c * (cell_w + gap)
            y0 = margin + r * (cell_h + gap)
            x1, y1 = x0 + cell_w, y0 + cell_h
            lx, ly = xx - x0, yy - y0
            inside = (lx >= 0) & (ly >= 0) & (xx < x1) & (yy < y1)
            # chamfered corners (pseudo-square mono wafers)
            dx = np.minimum(lx, x1 - xx)
            dy = np.minimum(ly, y1 - yy)
            inside &= (dx + dy) >= chamfer
            jitter = rng.normal(0, 0.012)
            t = 0.25 + 0.35 * noise + jitter
            col = base[None, None, :] * (1 - t[..., None]) + sheen[None, None, :] * t[..., None]
            img[inside] = col[inside]

            # fingers: faint horizontal lines
            fingers = inside & ((ly % (cell_h / 38)) < 1.0)
            img[fingers] = img[fingers] * 0.82 + 0.18 * _hex("#8c8aa0")
            # busbars: 5 vertical silver lines
            for b in range(5):
                bx = x0 + cell_w * (b + 0.5) / 5
                bars = inside & (np.abs(xx - bx) < 1.6)
                img[bars] = _hex("#a7a6b0")
            # half-cut split line
            split = inside & (np.abs(ly - cell_h / 2) < 1.4)
            img[split] = back

    img = np.clip(img, 0, 1)
    _save_png(path, img)
    return path


def _save_png(path, rgb):
    import bpy

    H, W, _ = rgb.shape
    os.makedirs(os.path.dirname(path), exist_ok=True)
    name = os.path.splitext(os.path.basename(path))[0]
    im = bpy.data.images.new(name, width=W, height=H, alpha=False)
    rgba = np.ones((H, W, 4), dtype=np.float32)
    rgba[..., :3] = rgb
    # Blender images are bottom-up; flip so row 0 of our array is the top of the image.
    im.pixels.foreach_set(rgba[::-1].ravel())
    im.filepath_raw = path
    im.file_format = "PNG"
    im.save()
    bpy.data.images.remove(im)
