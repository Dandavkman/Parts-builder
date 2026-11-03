"""Swept tubes and merges (Part Spec 3.0): pipes, ducts, manifold runners.

A tube is a circle swept along a path of straight runs joined by tangent arcs. Frame: the path
points are in the part frame, moved by the tube's placement. Hollow tubes have open ends. A merge
fuses tubes and then cuts every bore out of the fused solid, so passages that meet are open.
"""

import math

import cadquery as cq

from geometry.builder.features import Feature
from geometry.builder.placement import Anchor

DEFAULT_BEND_FACTOR = 1.5  # centerline bend radius = this x outer diameter when not given
MIN_WALL_MM = 0.5
EPS = 1e-6

Vec = tuple[float, float, float]


def _sub(a: Vec, b: Vec) -> Vec:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _dot(a: Vec, b: Vec) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _norm(a: Vec) -> float:
    return math.sqrt(_dot(a, a))


def _unit(a: Vec) -> Vec:
    n = _norm(a)
    return (a[0] / n, a[1] / n, a[2] / n)


def _along(p: Vec, d: Vec, t: float) -> Vec:
    return (p[0] + d[0] * t, p[1] + d[1] * t, p[2] + d[2] * t)


def bend_radius_mm(feature: Feature) -> float:
    default = DEFAULT_BEND_FACTOR * float(feature["outer_diameter_mm"])
    return float(feature.get("bend_radius_mm", default))


def _points(feature: Feature) -> list[Vec]:
    return [(float(x), float(y), float(z)) for x, y, z in feature["path_mm"]]


def _corners(points: list[Vec], radius: float) -> list[tuple[Vec, Vec, Vec, float]]:
    """For each interior point: (tangent point in, tangent point out, arc midpoint, turn angle)."""
    out = []
    for i in range(1, len(points) - 1):
        u = _unit(_sub(points[i], points[i - 1]))
        v = _unit(_sub(points[i + 1], points[i]))
        turn = math.acos(max(-1.0, min(1.0, _dot(u, v))))
        t = radius * math.tan(turn / 2)
        b = _unit(_sub(v, u))
        mid = _along(points[i], b, radius / math.cos(turn / 2) - radius)
        out.append((_along(points[i], u, -t), _along(points[i], v, t), mid, turn))
    return out


def check_tube(feature: Feature, anchors: dict[str, Anchor], errors: list[str]) -> None:
    name = f"tube '{feature['id']}'"
    anchor = feature["placement"]["anchor"]
    if anchor != "origin" and anchor not in anchors:
        errors.append(f"{name}: anchor '{anchor}' was not provided")
    points = _points(feature)
    od = float(feature["outer_diameter_mm"])
    wall = feature.get("wall_thickness_mm")
    if wall is not None and (wall < MIN_WALL_MM or 2 * wall >= od):
        errors.append(
            f"{name}: wall_thickness_mm must be at least {MIN_WALL_MM} mm and less than half "
            "the outer diameter"
        )
    radius = bend_radius_mm(feature)
    problems = len(errors)
    for i, (a, b) in enumerate(zip(points, points[1:], strict=False), start=1):
        if _norm(_sub(b, a)) < EPS:
            errors.append(f"{name}: path points {i} and {i + 1} are the same point")
    if len(errors) > problems:
        return
    tangents = [0.0] * len(points)
    for i in range(1, len(points) - 1):
        u = _unit(_sub(points[i], points[i - 1]))
        v = _unit(_sub(points[i + 1], points[i]))
        turn = math.acos(max(-1.0, min(1.0, _dot(u, v))))
        if turn > math.radians(179):
            errors.append(f"{name}: the path doubles back at point {i + 1}")
            continue
        if turn > math.radians(0.01) and radius <= od / 2:
            errors.append(
                f"{name}: bend_radius_mm {radius:g} must be larger than the tube radius {od / 2:g}"
            )
            return
        tangents[i] = radius * math.tan(turn / 2)
    for i, (a, b) in enumerate(zip(points, points[1:], strict=False)):
        if tangents[i] + tangents[i + 1] > _norm(_sub(b, a)) - EPS:
            errors.append(
                f"{name}: the run from point {i + 1} to {i + 2} is too short for its bends "
                f"(needs {tangents[i] + tangents[i + 1]:.1f} mm, has {_norm(_sub(b, a)):.1f} mm)"
            )


def _wire(points: list[Vec], radius: float) -> cq.Wire:
    edges: list[cq.Edge] = []
    cursor = points[0]
    for a, b, mid, turn in _corners(points, radius):
        if turn < math.radians(0.01):
            continue  # a collinear point needs no arc; the run continues through it
        edges.append(cq.Edge.makeLine(cq.Vector(*cursor), cq.Vector(*a)))
        edges.append(cq.Edge.makeThreePointArc(cq.Vector(*a), cq.Vector(*mid), cq.Vector(*b)))
        cursor = b
    edges.append(cq.Edge.makeLine(cq.Vector(*cursor), cq.Vector(*points[-1])))
    return cq.Wire.assembleEdges(edges)


def _simplify(points: list[Vec]) -> list[Vec]:
    """Drop interior points that sit on a straight line, so they need no arc."""
    kept = [points[0]]
    for i in range(1, len(points) - 1):
        u = _unit(_sub(points[i], kept[-1]))
        v = _unit(_sub(points[i + 1], points[i]))
        if _dot(u, v) < 1 - 1e-9:
            kept.append(points[i])
    kept.append(points[-1])
    return kept


def build_tube(feature: Feature) -> tuple[cq.Shape, cq.Shape | None]:
    """The tube's outer solid (full round) and its bore solid (None if solid), in the part frame."""
    points = _simplify(_points(feature))
    od = float(feature["outer_diameter_mm"])
    path = _wire(points, bend_radius_mm(feature))
    start = path.startPoint()
    direction = path.tangentAt(0)
    plane = cq.Plane(origin=start, normal=direction)

    def sweep(diameter: float) -> cq.Shape:
        shape = cq.Workplane(plane).circle(diameter / 2).sweep(cq.Workplane(obj=path)).val()
        assert isinstance(shape, cq.Shape)
        return shape

    outer = sweep(od)
    wall = feature.get("wall_thickness_mm")
    return outer, (sweep(od - 2 * float(wall)) if wall is not None else None)
