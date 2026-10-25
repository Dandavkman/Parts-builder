"""One function per Part Spec feature. Each takes the plate solid and returns a new solid.

Every cutter starts from a fresh workplane (see the `.center()` note in docs/decisions.md).
Plate frame: centered in X and Y, mid-plane at Z = 0.
"""

import math
from typing import Any

import cadquery as cq

from geometry.builder.checks import Point
from geometry.builder.errors import SpecError

Feature = dict[str, Any]
OVERCUT_MM = 1.0


def build_plate(feature: Feature) -> cq.Workplane:
    outline, t = feature["outline"], float(feature["thickness_mm"])
    if outline["kind"] == "rectangle":
        solid = cq.Workplane("XY").box(outline["width_mm"], outline["length_mm"], t)
        if outline.get("corner_radius_mm", 0) > 0:
            solid = solid.edges("|Z").fillet(outline["corner_radius_mm"])
        return solid
    points = [tuple(p) for p in outline["points_mm"]]
    return cq.Workplane("XY", origin=(0, 0, -t / 2)).polyline(points).close().extrude(t)


def _cutter(plate: Feature, x: float, y: float) -> cq.Workplane:
    """A fresh workplane below the plate at (x, y), ready to extrude through it."""
    t = float(plate["thickness_mm"])
    return cq.Workplane("XY", origin=(x, y, -t / 2 - OVERCUT_MM))


def _through_mm(plate: Feature) -> float:
    return float(plate["thickness_mm"]) + 2 * OVERCUT_MM


def hole_points(feature: Feature) -> list[Point]:
    """Hole centers for a `hole` or `hole_pattern`, in plate-local mm."""
    if feature["type"] == "hole":
        return [(float(feature["position_mm"][0]), float(feature["position_mm"][1]))]
    p = feature["pattern"]
    cx, cy = p.get("center_mm", [0, 0])
    if p["kind"] == "rectangular":
        return [
            (
                cx + (i - (p["count_x"] - 1) / 2) * p["spacing_x_mm"],
                cy + (j - (p["count_y"] - 1) / 2) * p["spacing_y_mm"],
            )
            for j in range(p["count_y"])
            for i in range(p["count_x"])
        ]
    start = p.get("start_angle_deg", 0)
    return [
        (
            cx + p["radius_mm"] * math.cos(math.radians(start + 360 * k / p["count"])),
            cy + p["radius_mm"] * math.sin(math.radians(start + 360 * k / p["count"])),
        )
        for k in range(p["count"])
    ]


def apply_holes(solid: cq.Workplane, plate: Feature, feature: Feature) -> cq.Workplane:
    for x, y in hole_points(feature):
        cutter = _cutter(plate, x, y).circle(feature["diameter_mm"] / 2).extrude(_through_mm(plate))
        solid = solid.cut(cutter)
    return solid


def slot_end_centers(feature: Feature) -> list[Point]:
    """Centers of the two rounded ends, in plate-local mm."""
    half = (feature["length_mm"] - feature["width_mm"]) / 2
    a = math.radians(feature.get("angle_deg", 0))
    x, y = feature["position_mm"]
    return [
        (x - half * math.cos(a), y - half * math.sin(a)),
        (x + half * math.cos(a), y + half * math.sin(a)),
    ]


def apply_slot(solid: cq.Workplane, plate: Feature, feature: Feature) -> cq.Workplane:
    x, y = feature["position_mm"]
    cutter = (
        _cutter(plate, x, y)
        .slot2D(feature["length_mm"], feature["width_mm"], feature.get("angle_deg", 0))
        .extrude(_through_mm(plate))
    )
    return solid.cut(cutter)


def _edges(solid: cq.Workplane, which: str) -> cq.Workplane:
    if which == "vertical":
        return solid.edges("|Z")
    if which == "top":
        return solid.faces(">Z").edges()
    if which == "bottom":
        return solid.faces("<Z").edges()
    return solid.edges()


def apply_edge_finish(solid: cq.Workplane, feature: Feature) -> cq.Workplane:
    """Apply a `fillet` or `chamfer`. Done before any cuts so only outline edges are selected."""
    try:
        if feature["type"] == "fillet":
            return _edges(solid, feature["edges"]).fillet(feature["radius_mm"])
        return _edges(solid, feature["edges"]).chamfer(feature["distance_mm"])
    except Exception as exc:  # OCC raises StdFail_NotDone and similar
        size = feature.get("radius_mm", feature.get("distance_mm"))
        raise SpecError(
            [
                f"{feature['type']} '{feature['id']}' of {size} mm does not fit on plate "
                f"'{feature['plate']}'; use a smaller value ({exc})"
            ]
        ) from exc
