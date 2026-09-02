#!/usr/bin/env python3
"""
BOOMTOWN trophy plate generator.

Output convention for the Glowforge:
  BLACK filled paths  = engrave (all lettering, converted to outlines)
  RED stroked rect    = cut (the plate outline)

Change PLATE_W_MM / PLATE_H_MM if the stock size changes, then rerun:
    python3 make_plates.py
"""

from matplotlib.textpath import TextPath
from matplotlib.font_manager import FontProperties
import os

# ---- Plate size in millimetres ----
PLATE_W_MM = 60.0
PLATE_H_MM = 20.0

# Blank margin around the cut line so the stroke is not clipped by the canvas.
BLEED_MM = 1.0

CUT_COLOR = "#FF0000"
CUT_STROKE_MM = 0.1
ENGRAVE_COLOR = "#000000"

# ---- Content: (year, team name, owner name) ----
PLATES = [
    ("2023", "DFCX2", "Brandon Kirkebo"),
    ("2024", "IMHIMIHENDRIX", "Maurice Strong"),
    ("2025", "EL JEFE", "Jeffery Laxamana"),
]

OUT_DIR = "/mnt/user-data/outputs"

SERIF_BOLD = FontProperties(family="DejaVu Serif", weight="bold")
SERIF = FontProperties(family="DejaVu Serif", weight="normal")


def text_path_d(text, font_prop, size):
    """Return an SVG path 'd' string plus width/height for the given text."""
    tp = TextPath((0, 0), text, size=size, prop=font_prop)
    verts = tp.vertices
    codes = tp.codes
    if len(verts) == 0:
        return "", 0.0, 0.0

    parts = []
    i = 0
    while i < len(codes):
        c = codes[i]
        if c == 1:
            parts.append(f"M {verts[i][0]:.4f} {verts[i][1]:.4f}")
            i += 1
        elif c == 2:
            parts.append(f"L {verts[i][0]:.4f} {verts[i][1]:.4f}")
            i += 1
        elif c == 3:
            parts.append(
                f"Q {verts[i][0]:.4f} {verts[i][1]:.4f} "
                f"{verts[i+1][0]:.4f} {verts[i+1][1]:.4f}"
            )
            i += 2
        elif c == 4:
            parts.append(
                f"C {verts[i][0]:.4f} {verts[i][1]:.4f} "
                f"{verts[i+1][0]:.4f} {verts[i+1][1]:.4f} "
                f"{verts[i+2][0]:.4f} {verts[i+2][1]:.4f}"
            )
            i += 3
        elif c == 79:
            parts.append("Z")
            i += 1
        else:
            i += 1

    xs = verts[:, 0]
    ys = verts[:, 1]
    return " ".join(parts), float(xs.max() - xs.min()), float(ys.max() - ys.min())


def fitted_line(text, font_prop, target_h, max_w):
    """Build one line, shrinking it if it would overrun the usable width."""
    d, w, h = text_path_d(text, font_prop, target_h)
    if w > max_w and w > 0:
        d, w, h = text_path_d(text, font_prop, target_h * (max_w / w))
    return d, w, h


def plate_group(year, team, owner, ox, oy, w, h, with_cut=True):
    """Engrave paths plus optional cut rect for one plate, offset by ox/oy."""
    side_margin = w * 0.05
    usable = w - (side_margin * 2)

    year_d, year_w, _ = fitted_line(year, SERIF_BOLD, h * 0.30, usable)
    team_d, team_w, _ = fitted_line(team, SERIF_BOLD, h * 0.19, usable)
    owner_d, owner_w, _ = fitted_line(owner, SERIF, h * 0.22, usable)

    # Baselines measured down from the top edge of the plate.
    year_base = h * 0.37
    team_base = h * 0.62
    owner_base = h * 0.90

    def place(d, tw, base):
        tx = ox + (w - tw) / 2.0
        ty = oy + base
        return (f'<g transform="translate({tx:.4f} {ty:.4f}) scale(1 -1)">'
                f'<path d="{d}" fill="{ENGRAVE_COLOR}"/></g>')

    parts = [
        place(year_d, year_w, year_base),
        place(team_d, team_w, team_base),
        place(owner_d, owner_w, owner_base),
    ]

    if with_cut:
        parts.insert(0, (
            f'<rect x="{ox:.4f}" y="{oy:.4f}" width="{w:.4f}" height="{h:.4f}" '
            f'fill="none" stroke="{CUT_COLOR}" stroke-width="{CUT_STROKE_MM}"/>'
        ))

    return "\n  ".join(parts)


def svg_doc(inner, w_mm, h_mm):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" version="1.1"\n'
            f'     width="{w_mm:.3f}mm" height="{h_mm:.3f}mm"\n'
            f'     viewBox="0 0 {w_mm:.3f} {h_mm:.3f}">\n'
            f'  {inner}\n'
            f'</svg>\n')


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    w, h = PLATE_W_MM, PLATE_H_MM
    written = []

    for year, team, owner in PLATES:
        inner = plate_group(year, team, owner, BLEED_MM, BLEED_MM, w, h)
        doc = svg_doc(inner, w + BLEED_MM * 2, h + BLEED_MM * 2)
        path = os.path.join(OUT_DIR, f"boomtown-plate-{year}.svg")
        with open(path, "w") as f:
            f.write(doc)
        written.append(path)

    gap = 5.0
    bodies = []
    for i, (year, team, owner) in enumerate(PLATES):
        bodies.append(plate_group(year, team, owner, BLEED_MM,
                                  BLEED_MM + i * (h + gap), w, h))
    sheet_h = h * len(PLATES) + gap * (len(PLATES) - 1) + BLEED_MM * 2
    doc = svg_doc("\n  ".join(bodies), w + BLEED_MM * 2, sheet_h)
    sheet_path = os.path.join(OUT_DIR, "boomtown-plates-all.svg")
    with open(sheet_path, "w") as f:
        f.write(doc)
    written.append(sheet_path)

    for p in written:
        print(p, os.path.getsize(p), "bytes")


if __name__ == "__main__":
    main()
