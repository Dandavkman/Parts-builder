"""Raised and engraved text, in one bundled open-license font so output never varies by host."""

import math
from pathlib import Path

import cadquery as cq

from geometry.builder.checks import Point, circle_fits
from geometry.builder.errors import SpecError
from geometry.builder.features import OVERCUT_MM, Feature, _embed_mm, _face_z_mm

FONT_PATH = Path(__file__).parent / "fonts" / "DejaVuSans-Bold.ttf"
CAP_HEIGHT_PER_EM = 0.729  # DejaVu Sans Bold capital letters are 0.729 of the font size


def apply_text(
    solid: cq.Workplane, plate: Feature, f: Feature, outline: list[Point]
) -> cq.Workplane:
    z, up = _face_z_mm(plate, f.get("face", "top"))
    x, y = f["position_mm"]
    angle = math.radians(f.get("angle_deg", 0))
    plane = cq.Plane(
        origin=(x, y, z), xDir=(math.cos(angle), math.sin(angle), 0), normal=(0, 0, up)
    )
    raised = f.get("mode", "raised") == "raised"
    depth = float(f["depth_mm"])
    # Raised text starts a little inside the plate so it fuses; engraved text starts above it.
    start, distance = (
        (-_embed_mm(plate), depth + _embed_mm(plate))
        if raised
        else (OVERCUT_MM, -(depth + OVERCUT_MM))
    )
    text = (
        cq.Workplane(plane)
        .workplane(offset=start)
        .text(
            f["text"],
            f["height_mm"] / CAP_HEIGHT_PER_EM,
            distance,
            combine=False,
            halign="center",
            valign="center",
            fontPath=str(FONT_PATH),
        )
    )
    shape = text.val()
    if not isinstance(shape, cq.Shape) or not shape.Solids():
        raise SpecError([f"text '{f['id']}' has no printable letters"])
    if not all(circle_fits((v.X, v.Y), 0.0, outline) for v in shape.Vertices()):
        raise SpecError([f"text '{f['id']}' extends past the edge of plate '{f['plate']}'"])
    return solid.union(text) if raised else solid.cut(text)
