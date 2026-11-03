"""Reducers and flanges (Part Spec 3.1) for pipework: pieces with open ends that bolt together.

A "piece" is a tube or a reducer. Every piece has a start and an end; at each the outward
direction points away from the pipe. A flange sits on one of those ends: its face is flush with the
open end and the plate runs back along the pipe by its thickness.
"""

import math
from collections.abc import Mapping

import cadquery as cq

from geometry.builder.features import Feature
from geometry.builder.tube import EPS, MIN_WALL_MM, Vec, _norm, _points, _sub, _unit

PIECES = ("tube", "reducer")


def piece_ends(piece: Feature) -> dict[str, tuple[Vec, Vec]]:
    """For 'start' and 'end': the end point and the outward direction, in the part frame."""
    if piece["type"] == "reducer":
        a: Vec = (
            float(piece["start_mm"][0]),
            float(piece["start_mm"][1]),
            float(piece["start_mm"][2]),
        )
        b: Vec = (float(piece["end_mm"][0]), float(piece["end_mm"][1]), float(piece["end_mm"][2]))
        d = _unit(_sub(b, a))
        return {"start": (a, (-d[0], -d[1], -d[2])), "end": (b, d)}
    pts = _points(piece)
    first = _unit(_sub(pts[1], pts[0]))
    last = _unit(_sub(pts[-1], pts[-2]))
    return {"start": (pts[0], (-first[0], -first[1], -first[2])), "end": (pts[-1], last)}


def end_diameter_mm(piece: Feature, end: str) -> float:
    """Outer diameter of the piece at one end."""
    if piece["type"] == "reducer":
        return float(piece[f"{end}_diameter_mm"])
    return float(piece["outer_diameter_mm"])


def build_reducer(feature: Feature) -> tuple[cq.Shape, cq.Shape | None]:
    a = cq.Vector(*(float(v) for v in feature["start_mm"]))
    b = cq.Vector(*(float(v) for v in feature["end_mm"]))
    axis = b - a
    r1, r2 = float(feature["start_diameter_mm"]) / 2, float(feature["end_diameter_mm"]) / 2

    def cone(ra: float, rb: float, extra: float = 0.0) -> cq.Shape:
        return cq.Solid.makeCone(ra, rb, axis.Length, a, axis.normalized())

    outer = cone(r1, r2)
    wall = feature.get("wall_thickness_mm")
    return outer, (cone(r1 - float(wall), r2 - float(wall)) if wall is not None else None)


def _flange_plane(flange: Feature, piece: Feature) -> cq.Plane:
    point, normal = piece_ends(piece)[flange["end"]]
    # X is the world Z crossed with the outward direction, so it is the same on every machine.
    x = (-normal[1], normal[0], 0.0)
    if _norm(x) < 1e-6:
        x = (1.0, 0.0, 0.0)
    return cq.Plane(origin=point, xDir=x, normal=normal)


def bolt_points(flange: Feature) -> list[tuple[float, float]]:
    pattern = flange["bolt_holes"]["pattern"]
    if pattern["kind"] == "points":
        return [(float(x), float(y)) for x, y in pattern["points_mm"]]
    n, r = int(pattern["count"]), float(pattern["circle_diameter_mm"]) / 2
    start = float(pattern.get("start_angle_deg", 0))
    return [
        (
            r * math.cos(math.radians(start + 360 * i / n)),
            r * math.sin(math.radians(start + 360 * i / n)),
        )
        for i in range(n)
    ]


def build_flange(flange: Feature, piece: Feature) -> tuple[cq.Shape, list[cq.Shape]]:
    """The flange plate (to fuse onto the piece) and the bolt hole cutters."""
    plane = _flange_plane(flange, piece)
    t = float(flange["thickness_mm"])
    outline = flange["outline"]
    sketch = cq.Workplane(plane)
    sketch = (
        sketch.circle(float(outline["diameter_mm"]) / 2)
        if outline["kind"] == "circle"
        else sketch.rect(float(outline["width_mm"]), float(outline["length_mm"]))
    )
    plate = sketch.extrude(-t).val()
    cutters: list[cq.Shape] = []
    if "bolt_holes" in flange:
        radius = float(flange["bolt_holes"]["hole_diameter_mm"]) / 2
        for x, y in bolt_points(flange):
            hole = (
                cq.Workplane(plane)
                .workplane(offset=1)
                .center(x, y)
                .circle(radius)
                .extrude(-(t + 2))
            )
            cutter = hole.val()
            assert isinstance(cutter, cq.Shape)
            cutters.append(cutter)
    assert isinstance(plate, cq.Shape)
    return plate, cutters


def check_reducer(feature: Feature, anchors: Mapping[str, object], errors: list[str]) -> None:
    name = f"reducer '{feature['id']}'"
    anchor = feature["placement"]["anchor"]
    if anchor != "origin" and anchor not in anchors:
        errors.append(f"{name}: anchor '{anchor}' was not provided")
    a: Vec = (
        float(feature["start_mm"][0]),
        float(feature["start_mm"][1]),
        float(feature["start_mm"][2]),
    )
    b: Vec = (float(feature["end_mm"][0]), float(feature["end_mm"][1]), float(feature["end_mm"][2]))
    if _norm(_sub(b, a)) < EPS:
        errors.append(f"{name}: start_mm and end_mm are the same point")
        return
    wall = feature.get("wall_thickness_mm")
    smallest = min(float(feature["start_diameter_mm"]), float(feature["end_diameter_mm"]))
    if wall is not None and (wall < MIN_WALL_MM or 2 * wall >= smallest):
        errors.append(
            f"{name}: wall_thickness_mm must be at least {MIN_WALL_MM} mm and less than half "
            "the smaller diameter"
        )


def check_flange(
    flange: Feature, seen: dict[str, Feature], used: set[tuple[str, str]], errors: list[str]
) -> None:
    name = f"flange '{flange['id']}'"
    piece = seen.get(flange["tube"])
    if piece is None or piece["type"] not in PIECES:
        errors.append(f"{name}: '{flange['tube']}' is not a tube or reducer in this spec")
        return
    key = (piece["id"], flange["end"])
    if key in used:
        errors.append(f"{name}: '{piece['id']}' already has a flange on its {flange['end']}")
    used.add(key)
    if "wall_thickness_mm" not in piece:
        errors.append(
            f"{name}: '{piece['id']}' is solid; a flange needs a hollow pipe "
            "(set wall_thickness_mm)"
        )
    od = end_diameter_mm(piece, flange["end"])
    outline = flange["outline"]
    if outline["kind"] == "circle":
        half_x = half_y = float(outline["diameter_mm"]) / 2
    else:
        half_x, half_y = float(outline["width_mm"]) / 2, float(outline["length_mm"]) / 2
    if min(half_x, half_y) * 2 <= od:
        errors.append(f"{name}: the flange must be wider than the pipe it sits on ({od:g} mm)")
    holes = flange.get("bolt_holes")
    if holes is None:
        return
    hd = float(holes["hole_diameter_mm"])
    for x, y in bolt_points(flange):
        if math.hypot(x, y) < od / 2 + hd / 2:
            errors.append(f"{name}: a bolt hole at [{x:.1f}, {y:.1f}] mm touches the pipe wall")
        elif outline["kind"] == "circle" and math.hypot(x, y) + hd / 2 > half_x:
            errors.append(f"{name}: a bolt hole at [{x:.1f}, {y:.1f}] mm runs off the flange")
        elif outline["kind"] == "rectangle" and (
            abs(x) + hd / 2 > half_x or abs(y) + hd / 2 > half_y
        ):
            errors.append(f"{name}: a bolt hole at [{x:.1f}, {y:.1f}] mm runs off the flange")
