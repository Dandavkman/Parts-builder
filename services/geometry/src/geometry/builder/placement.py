"""Anchors and plate placement.

A plate is built in its own frame: centered on the origin in X and Y, with its mid-plane at
Z = 0, so the top face is at +thickness/2. Placement moves that frame onto an anchor: the frame's
Z axis lines up with the anchor normal, then `rotation_deg` turns it about that normal, then
`offset_mm` moves it along the rotated frame's axes.
"""

import math
from dataclasses import dataclass

import cadquery as cq

Vec = tuple[float, float, float]


@dataclass(frozen=True)
class Anchor:
    """A point picked on the scan, with the surface normal there."""

    point_mm: Vec
    normal: Vec = (0.0, 0.0, 1.0)


ORIGIN = Anchor((0.0, 0.0, 0.0))


def _unit(v: Vec) -> Vec:
    n = math.sqrt(sum(c * c for c in v))
    if n == 0:
        raise ValueError("anchor normal must not be zero")
    return (v[0] / n, v[1] / n, v[2] / n)


def _cross(a: Vec, b: Vec) -> Vec:
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def _rotate_about(v: Vec, axis: Vec, deg: float) -> Vec:
    """Rodrigues rotation of v about a unit axis."""
    t = math.radians(deg)
    c, s = math.cos(t), math.sin(t)
    k = _cross(axis, v)
    d = sum(a * b for a, b in zip(axis, v, strict=True))
    return tuple(v[i] * c + k[i] * s + axis[i] * d * (1 - c) for i in range(3))  # type: ignore[return-value]


def placement_location(
    anchor: Anchor, offset_mm: Vec = (0.0, 0.0, 0.0), rotation_deg: float = 0.0
) -> cq.Location:
    z = _unit(anchor.normal)
    ref: Vec = (0.0, 0.0, 1.0)
    x = _cross(ref, z)
    x = (1.0, 0.0, 0.0) if math.hypot(*x) < 1e-9 else _unit(x)
    x = _rotate_about(x, z, rotation_deg)
    y = _cross(z, x)
    origin: Vec = tuple(  # type: ignore[assignment]
        anchor.point_mm[i] + offset_mm[0] * x[i] + offset_mm[1] * y[i] + offset_mm[2] * z[i]
        for i in range(3)
    )
    return cq.Location(cq.Plane(origin=origin, xDir=x, normal=z))
