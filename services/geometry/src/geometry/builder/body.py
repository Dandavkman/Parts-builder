"""Solid bodies (Part Spec 2.0): extruded outlines and revolved profiles, optionally hollowed.

Body frame: origin at the center of the base, Z up, so the base is at Z = 0 and the top at
Z = height_mm. Hollowing cuts an inset copy of the outline instead of using the CAD kernel's
shell operation, which fails on rounded edges; the walls are exactly wall_thickness_mm.
"""

import math

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


def _profile(shape: Feature) -> list[tuple[float, float]]:
    return [(float(r), float(z)) for r, z in shape["profile_mm"]]


def _revolve(points: list[tuple[float, float]]) -> cq.Workplane:
    """Revolve a closed [radius, z] polygon about Z. The XZ workplane maps local y to global Z."""
    return cq.Workplane("XZ").polyline(points).close().revolve(360, (0, 0, 0), (0, 1, 0))


def inset_profile(
    profile: list[tuple[float, float]], wall: float, reach_mm: float
) -> list[tuple[float, float]]:
    """Cavity polygon [radius, z] for walls of `wall` mm, open at the top.

    Shifts each profile segment toward the axis by the wall thickness, joins neighbours with sharp
    corners, starts at the floor (z = first z + wall) and runs `reach_mm` above the rim. Raises
    ValueError with a plain sentence if the walls leave no room.
    """
    lines = []
    for (r1, z1), (r2, z2) in zip(profile, profile[1:], strict=False):
        length = math.hypot(r2 - r1, z2 - z1)
        nr, nz = -(z2 - z1) / length, (r2 - r1) / length  # unit normal toward the axis
        lines.append(((r1 + wall * nr, z1 + wall * nz), (r2 - r1, z2 - z1)))

    def at_z(
        line: tuple[tuple[float, float], tuple[float, float]], z: float
    ) -> tuple[float, float]:
        (pr, pz), (dr, dz) = line
        t = (z - pz) / dz
        return (pr + t * dr, z)

    z_floor = profile[0][1] + wall
    pts = [at_z(lines[0], z_floor)]
    for a, b in zip(lines, lines[1:], strict=False):
        (ar, az), (adr, adz) = a
        (br, bz), (bdr, bdz) = b
        det = adr * bdz - adz * bdr
        if abs(det) < 1e-9:  # same direction: the corner is a straight continuation
            pts.append((br, bz))
            continue
        t = ((br - ar) * bdz - (bz - az) * bdr) / det
        pts.append((ar + t * adr, az + t * adz))
    pts.append(at_z(lines[-1], profile[-1][1] + reach_mm))
    if any(r <= 1e-6 for r, _ in pts) or any(
        z2 <= z1 for (_, z1), (_, z2) in zip(pts, pts[1:], strict=False)
    ):
        raise ValueError("the walls leave no room inside the profile")
    return [(0.0, pts[0][1]), *pts, (0.0, pts[-1][1])]


def build_body(feature: Feature) -> cq.Workplane:
    shape = feature["shape"]
    if shape["kind"] == "revolve":
        profile = _profile(shape)
        top_z = profile[-1][1]
        solid = _revolve([(0.0, profile[0][1]), *profile, (0.0, top_z)])
    else:
        top_z = float(shape["height_mm"])
        solid = _prism(shape["outline"], 0.0, top_z)
    fillet = float(feature.get("edge_fillet_mm", 0))
    if fillet > 0:
        solid = solid.faces(">Z or <Z").edges().fillet(fillet)
    shell = feature.get("shell")
    if shell:
        wall = float(shell["wall_thickness_mm"])
        if shape["kind"] == "revolve":
            cavity = _revolve(inset_profile(profile, wall, wall + OVERCUT_MM))
            if shell["open"] == "none":
                cavity = cavity.intersect(
                    cq.Workplane("XY", origin=(0, 0, profile[0][1]))
                    .circle(1e4)
                    .extrude(top_z - wall - profile[0][1])
                )
        elif shell["open"] == "top":
            cavity = _prism(shape["outline"], wall, top_z - wall + OVERCUT_MM, inset=wall)
        else:
            cavity = _prism(shape["outline"], wall, top_z - 2 * wall, inset=wall)
        solid = solid.cut(cavity)
    return solid


def check_body(feature: Feature, anchors: dict[str, Anchor], errors: list[str]) -> None:
    """Problems the schema cannot see, as plain sentences."""
    name = f"body '{feature['id']}'"
    anchor = feature["placement"]["anchor"]
    if anchor != "origin" and anchor not in anchors:
        errors.append(f"{name}: anchor '{anchor}' was not provided")
    shape = feature["shape"]
    profile: list[tuple[float, float]] = []
    if shape["kind"] == "revolve":
        profile = _profile(shape)
        if any(r <= 0 for r, _ in profile):
            errors.append(f"{name}: every radius in profile_mm must be greater than 0")
        if any(z2 <= z1 for (_, z1), (_, z2) in zip(profile, profile[1:], strict=False)):
            errors.append(
                f"{name}: z in profile_mm must increase at every point (no overhangs or flat steps)"
            )
        if any(e.startswith(name) for e in errors):
            return
        height = profile[-1][1] - profile[0][1]
        span = 2 * min(profile[0][0], profile[-1][0])
    else:
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
        if profile:
            try:
                inset_profile(profile, wall, wall + OVERCUT_MM)
            except ValueError:
                errors.append(f"{name}: walls of {wall:g} mm leave no room inside the profile")
        elif 2 * wall >= span:
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
