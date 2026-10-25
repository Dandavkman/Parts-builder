"""Plain geometry checks on plate-local 2D shapes, used to give clear errors before any CAD."""

import math

Point = tuple[float, float]
EPS_MM = 1e-6
CIRCLE_CHECK_STEPS = (
    128  # a circle is checked as a 128-sided polygon, off by under 0.04% of its radius
)


def outline_points(outline: dict[str, object]) -> list[Point]:
    if outline["kind"] == "rectangle":
        w, l = float(outline["width_mm"]) / 2, float(outline["length_mm"]) / 2  # type: ignore[arg-type]  # noqa: E741
        return [(-w, -l), (w, -l), (w, l), (-w, l)]
    if outline["kind"] == "circle":
        r = float(outline["diameter_mm"]) / 2  # type: ignore[arg-type]
        steps = CIRCLE_CHECK_STEPS
        return [
            (r * math.cos(2 * math.pi * i / steps), r * math.sin(2 * math.pi * i / steps))
            for i in range(steps)
        ]
    return [(float(p[0]), float(p[1])) for p in outline["points_mm"]]  # type: ignore[attr-defined]


def _inside(p: Point, poly: list[Point]) -> bool:
    inside = False
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1], strict=True):
        if (y1 > p[1]) != (y2 > p[1]) and p[0] < (x2 - x1) * (p[1] - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def _dist_to_segment(p: Point, a: Point, b: Point) -> float:
    dx, dy = b[0] - a[0], b[1] - a[1]
    length_sq = dx * dx + dy * dy
    t = (
        0.0
        if length_sq == 0
        else max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length_sq))
    )
    return math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))


def circle_fits(center: Point, radius_mm: float, poly: list[Point]) -> bool:
    """True if a circle lies fully inside the polygon."""
    if not _inside(center, poly):
        return False
    edges = zip(poly, poly[1:] + poly[:1], strict=True)
    return min(_dist_to_segment(center, a, b) for a, b in edges) >= radius_mm - EPS_MM
