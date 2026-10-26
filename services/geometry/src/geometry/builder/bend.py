"""Bends: join an edge of one plate to an edge of another through a rounded bend.

Worked in a "bend frame" where the from-plate's bending edge is its +Y edge. The bend is a
quarter-ish annulus (angle_deg of turn) on the plate's top side, so the inner surface is the top
face. The to-plate then continues along the tangent at the end of the bend.
"""

import math

import cadquery as cq

from geometry.builder.features import Feature

# Rotation about Z (degrees) that brings each edge onto +Y (from side) or -Y (to side).
TO_PLUS_Y = {"+y": 0.0, "-y": 180.0, "+x": 90.0, "-x": -90.0}
TO_MINUS_Y = {"-y": 0.0, "+y": 180.0, "-x": 90.0, "+x": -90.0}


def edge_dims_mm(plate: Feature, edge: str) -> tuple[float, float]:
    """(extent across the plate toward the edge, length of the edge) for a rectangle plate."""
    o = plate["outline"]
    return (
        (o["length_mm"], o["width_mm"]) if edge in ("+y", "-y") else (o["width_mm"], o["length_mm"])
    )


def _rotz(shape: cq.Shape, deg: float) -> cq.Shape:
    return shape.rotate(cq.Vector(0, 0, 0), cq.Vector(0, 0, 1), deg)


def join_plates(
    from_solid: cq.Workplane,
    to_solid: cq.Workplane,
    from_plate: Feature,
    to_plate: Feature,
    bend: Feature,
) -> cq.Workplane:
    """Fuse the to-plate onto the from-plate, both in the from-plate's own frame."""
    t = float(from_plate["thickness_mm"])
    ri, theta = float(bend["inner_radius_mm"]), float(bend["angle_deg"])
    reach, width = edge_dims_mm(from_plate, bend["from_edge"])
    to_reach, _ = edge_dims_mm(to_plate, bend["to_edge"])
    a_from = TO_PLUS_Y[bend["from_edge"]]
    a_to = TO_MINUS_Y[bend["to_edge"]]

    cy, cz = reach / 2, t / 2 + ri  # center of curvature in the (y, z) plane
    outer = ri + t
    phi0, phi1 = -90.0, theta - 90.0

    def at(radius: float, phi: float) -> tuple[float, float]:
        return (
            cy + radius * math.cos(math.radians(phi)),
            cz + radius * math.sin(math.radians(phi)),
        )

    wp = cq.Workplane("YZ")
    wp = wp.moveTo(*at(outer, phi0)).threePointArc(at(outer, (phi0 + phi1) / 2), at(outer, phi1))
    if ri > 0:
        wp = wp.lineTo(*at(ri, phi1)).threePointArc(at(ri, (phi0 + phi1) / 2), at(ri, phi0))
    else:
        wp = wp.lineTo(cy, cz)
    sector = wp.close().extrude(width / 2, both=True)

    mid_y, mid_z = at(ri + t / 2, phi1)
    tangent = (math.cos(math.radians(theta)), math.sin(math.radians(theta)))
    normal = (-math.sin(math.radians(theta)), math.cos(math.radians(theta)))
    origin = (0.0, mid_y + tangent[0] * to_reach / 2, mid_z + tangent[1] * to_reach / 2)
    frame = cq.Location(cq.Plane(origin=origin, xDir=(1, 0, 0), normal=(0, normal[0], normal[1])))

    to_part = _rotz(to_solid.val(), a_to).moved(frame)  # type: ignore[arg-type]
    from_part = _rotz(from_solid.val(), a_from)  # type: ignore[arg-type]
    fused = (
        cq.Workplane("XY")
        .newObject([from_part])
        .union(sector)
        .union(cq.Workplane("XY").newObject([to_part]))
    )
    return fused.rotate((0, 0, 0), (0, 0, 1), -a_from)
