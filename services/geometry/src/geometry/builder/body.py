"""Solid bodies (Part Spec 2.0): extruded outlines, optionally hollowed and rounded.

Body frame: origin at the center of the base, Z up, so the base is at Z = 0 and the top at
Z = height_mm. Hollowing cuts an inset copy of the outline instead of using the CAD kernel's
shell operation, which fails on rounded edges; the walls are exactly wall_thickness_mm.
"""

import cadquery as cq

from geometry.builder.checks import outline_points
from geometry.builder.features import Feature
from geometry.builder.placement import Anchor

OVERCUT_MM = 1.0


def min_span_mm(outline: Feature) -> float:
    """The shortest distance across the outline, used to check that walls leave room inside."""
    if outline["kind"] == "rectangle":
        return float(min(outline["width_mm"], outline["length_mm"]))
    if outline["kind"] == "circle":
        return float(outline["diameter_mm"])
    xs, ys = zip(*outline_points(outline), strict=True)
    return float(min(max(xs) - min(xs), max(ys) - min(ys)))


def _prism(outline: Feature, z0: float, height: float, inset: float = 0.0) -> cq.Workplane:
    """The outline, pulled in by `inset` mm all round, extruded up from z0."""
    plane = cq.Workplane("XY", origin=(0, 0, z0))
    kind = outline["kind"]
    if kind == "circle":
        return plane.circle(float(outline["diameter_mm"]) / 2 - inset).extrude(height)
    if kind == "rectangle":
        w = float(outline["width_mm"]) - 2 * inset
        length = float(outline["length_mm"]) - 2 * inset
        radius = max(float(outline.get("corner_radius_mm", 0)) - inset, 0.0)
        solid = plane.rect(w, length).extrude(height)
        return solid.edges("|Z").fillet(radius) if radius > 0 else solid
    points = [tuple(p) for p in outline["points_mm"]]
    wire = plane.polyline(points).close()
    return (wire.offset2D(-inset, "intersection") if inset else wire).extrude(height)


def build_body(feature: Feature) -> cq.Workplane:
    shape = feature["shape"]
    height = float(shape["height_mm"])
    outline = shape["outline"]
    solid = _prism(outline, 0.0, height)
    fillet = float(feature.get("edge_fillet_mm", 0))
    if fillet > 0:
        solid = solid.faces(">Z or <Z").edges().fillet(fillet)
    shell = feature.get("shell")
    if shell:
        wall = float(shell["wall_thickness_mm"])
        if shell["open"] == "top":
            cavity = _prism(outline, wall, height - wall + OVERCUT_MM, inset=wall)
        else:
            cavity = _prism(outline, wall, height - 2 * wall, inset=wall)
        solid = solid.cut(cavity)
    return solid


def check_body(feature: Feature, anchors: dict[str, Anchor], errors: list[str]) -> None:
    """Problems the schema cannot see, as plain sentences."""
    name = f"body '{feature['id']}'"
    anchor = feature["placement"]["anchor"]
    if anchor != "origin" and anchor not in anchors:
        errors.append(f"{name}: anchor '{anchor}' was not provided")
    shape = feature["shape"]
    outline = shape["outline"]
    height = float(shape["height_mm"])
    span = min_span_mm(outline)
    if outline["kind"] == "rectangle" and float(outline.get("corner_radius_mm", 0)) > span / 2:
        errors.append(f"{name}: corner_radius_mm is larger than half the shorter side")
    fillet = float(feature.get("edge_fillet_mm", 0))
    if fillet and (fillet >= height / 2 or fillet >= span / 2):
        errors.append(
            f"{name}: edge_fillet_mm must be less than half the height and half the width"
        )
    shell = feature.get("shell")
    if shell:
        wall = float(shell["wall_thickness_mm"])
        if 2 * wall >= span:
            errors.append(
                f"{name}: walls of {wall:g} mm leave no room inside an outline {span:g} mm across"
            )
        floors = 1 if shell["open"] == "top" else 2
        if floors * wall >= height:
            errors.append(
                f"{name}: wall_thickness_mm ({wall:g} mm) is too large "
                f"for height_mm ({height:g} mm)"
            )
        if fillet and shell["open"] == "top" and fillet >= wall:
            errors.append(
                f"{name}: edge_fillet_mm must be less than the wall thickness, "
                "or the rim would be rounded away"
            )
