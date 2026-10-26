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
CUTOUT_REACH_MM = 500.0


def build_plate(feature: Feature) -> cq.Workplane:
    outline, t = feature["outline"], float(feature["thickness_mm"])
    if outline["kind"] == "rectangle":
        solid = cq.Workplane("XY").box(outline["width_mm"], outline["length_mm"], t)
        if outline.get("corner_radius_mm", 0) > 0:
            solid = solid.edges("|Z").fillet(outline["corner_radius_mm"])
        return solid
    if outline["kind"] == "circle":
        return (
            cq.Workplane("XY", origin=(0, 0, -t / 2))
            .circle(float(outline["diameter_mm"]) / 2)
            .extrude(t)
        )
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


def apply_counterbore(solid: cq.Workplane, plate: Feature, f: Feature) -> cq.Workplane:
    t, (x, y) = float(plate["thickness_mm"]), f["position_mm"]
    solid = apply_holes(solid, plate, {**f, "type": "hole"})
    bore = (
        cq.Workplane("XY", origin=(x, y, t / 2 - f["bore_depth_mm"]))
        .circle(f["bore_diameter_mm"] / 2)
        .extrude(f["bore_depth_mm"] + OVERCUT_MM)
    )
    return solid.cut(bore)


def countersink_depth_mm(f: Feature) -> float:
    half_angle = math.radians(f.get("sink_angle_deg", 90) / 2)
    return float((f["sink_diameter_mm"] - f["diameter_mm"]) / 2 / math.tan(half_angle))


def apply_countersink(solid: cq.Workplane, plate: Feature, f: Feature) -> cq.Workplane:
    t, (x, y) = float(plate["thickness_mm"]), f["position_mm"]
    solid = apply_holes(solid, plate, {**f, "type": "hole"})
    depth = countersink_depth_mm(f)
    half_angle = math.radians(f.get("sink_angle_deg", 90) / 2)
    # Run the cone one overcut past the top face so the cut leaves no coplanar sliver.
    cone = cq.Solid.makeCone(
        f["diameter_mm"] / 2,
        f["sink_diameter_mm"] / 2 + OVERCUT_MM * math.tan(half_angle),
        depth + OVERCUT_MM,
        cq.Vector(x, y, t / 2 - depth),
        cq.Vector(0, 0, 1),
    )
    return solid.cut(cone)


def _face_z_mm(plate: Feature, face: str) -> tuple[float, float]:
    """Plate face height and the direction (+1 up, -1 down) a feature on it grows."""
    half = float(plate["thickness_mm"]) / 2
    return (half, 1.0) if face == "top" else (-half, -1.0)


def _embed_mm(plate: Feature) -> float:
    return min(float(plate["thickness_mm"]) / 2, 0.5)


def apply_standoff_body(solid: cq.Workplane, plate: Feature, f: Feature) -> cq.Workplane:
    z, up = _face_z_mm(plate, f.get("face", "top"))
    embed = _embed_mm(plate)
    x, y = f["position_mm"]
    post = (
        cq.Workplane("XY", origin=(x, y, z - up * embed))
        .circle(f["outer_diameter_mm"] / 2)
        .extrude(up * (f["height_mm"] + embed))
    )
    return solid.union(post)


def apply_standoff_hole(solid: cq.Workplane, plate: Feature, f: Feature) -> cq.Workplane:
    """Drill a standoff's bore through the post and the plate."""
    if not f.get("hole_diameter_mm"):
        return solid
    x, y = f["position_mm"]
    half = float(plate["thickness_mm"]) / 2
    z, up = _face_z_mm(plate, f.get("face", "top"))
    post_end = z + up * f["height_mm"]
    low, high = min(-half, post_end), max(half, post_end)
    bore = (
        cq.Workplane("XY", origin=(x, y, low - OVERCUT_MM))
        .circle(f["hole_diameter_mm"] / 2)
        .extrude(high - low + 2 * OVERCUT_MM)
    )
    return solid.cut(bore)


def apply_rib(solid: cq.Workplane, plate: Feature, f: Feature) -> cq.Workplane:
    (x1, y1), (x2, y2) = f["start_mm"], f["end_mm"]
    length, h, thick = math.hypot(x2 - x1, y2 - y1), float(f["height_mm"]), float(f["thickness_mm"])
    embed = _embed_mm(plate)
    if f.get("profile", "rectangular") == "rectangular":
        profile = [(-length / 2, -embed), (length / 2, -embed), (length / 2, h), (-length / 2, h)]
    else:  # a gusset: full height at the start, zero at the end
        profile = [(-length / 2, -embed), (length / 2, -embed), (length / 2, 0), (-length / 2, h)]
    body = cq.Workplane("XZ").polyline(profile).close().extrude(thick / 2, both=True)
    z, up = _face_z_mm(plate, f.get("face", "top"))
    if up < 0:
        body = body.mirror("XY")
    body = body.rotate((0, 0, 0), (0, 0, 1), math.degrees(math.atan2(y2 - y1, x2 - x1)))
    body = body.translate(((x1 + x2) / 2, (y1 + y2) / 2, z))
    return solid.union(body)


def apply_cutout(
    solid: cq.Workplane, f: Feature, cutter_loc: cq.Location, plate_loc: cq.Location
) -> cq.Workplane:
    """Cut a clearance zone given in the cutter's anchor frame; `plate_loc` places the plate."""
    zone, margin = f["zone"], float(f.get("margin_mm", 0))
    wp = cq.Workplane("XY")
    if zone["kind"] == "circle":
        wp = wp.circle(zone["diameter_mm"] / 2 + margin)
    else:
        wp = wp.rect(zone["width_mm"] + 2 * margin, zone["length_mm"] + 2 * margin)
    cutter = wp.extrude(CUTOUT_REACH_MM, both=True).val()
    assert isinstance(cutter, cq.Shape)
    cutter = cutter.moved(cutter_loc).moved(plate_loc.inverse)
    before = solid.val().Volume()  # type: ignore[union-attr]
    cut = solid.cut(cq.Workplane("XY").newObject([cutter]))
    if abs(before - cut.val().Volume()) < 1e-6:  # type: ignore[union-attr]
        raise SpecError([f"cutout '{f['id']}' does not touch plate '{f['plate']}'"])
    return cut
