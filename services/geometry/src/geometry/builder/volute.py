"""Turbine volute (Part Spec 3.2): a scroll housing sized from A/R, with an inlet and an outlet.

Frame: origin on the wheel axis at the wheel plane, Z along the axis, the exhaust outlet towards -Z.
The scroll starts at the tongue on the +X axis and winds counter-clockwise (seen from +Z) through
360 degrees. Its passage has a round section whose area grows linearly with the angle (so the
section radius grows as the square root of the angle), and its inner edge touches the wheel cavity.
The inlet is a straight stub on the last section, on the +X side, flowing in +Y and entering from
-Y. This is a simplified housing: no wastegate, no bearing flange, no nozzle vanes.
"""

import math
from collections.abc import Mapping

import cadquery as cq

from geometry.builder.features import Feature

SECTIONS = 36
FIRST_ANGLE_DEG = 6.0
CAVITY_OVERLAP_MM = 0.3
MIN_WALL_MM = 1.0
OUTLET_MARGIN_MM = 10.0


class VoluteSize:
    """The numbers every part of the volute is built from."""

    def __init__(self, feature: Feature) -> None:
        self.wall = float(feature["wall_thickness_mm"])
        self.cavity_r = float(feature["inducer_diameter_mm"]) / 2 + float(
            feature.get("tongue_clearance_mm", 2)
        )
        k = float(feature["a_over_r_cm"]) * 10  # A/R in cm is area (cm2) over radius (cm)
        # Area pi*rho^2 over centroid radius (cavity_r + rho) equals k: solve for rho.
        self.rho_max = (k + math.sqrt(k * k + 4 * math.pi * k * self.cavity_r)) / (2 * math.pi)
        self.rc_max = self.cavity_r + self.rho_max
        self.inlet_length = float(feature.get("inlet_length_mm", 30))
        self.outlet_length = float(feature.get("outlet_length_mm", 60))
        self.exducer_r = float(feature["exducer_diameter_mm"]) / 2

    def rho(self, angle_deg: float) -> float:
        return self.rho_max * math.sqrt(angle_deg / 360)

    @property
    def inlet_outer_diameter(self) -> float:
        return 2 * (self.rho_max + self.wall)

    @property
    def min_outlet_length(self) -> float:
        return self.rho_max + self.wall + OUTLET_MARGIN_MM


def inlet_end(feature: Feature) -> tuple[tuple[float, float, float], tuple[float, float, float]]:
    s = VoluteSize(feature)
    return (s.rc_max, -s.inlet_length, 0.0), (0.0, -1.0, 0.0)


def outlet_end(feature: Feature) -> tuple[tuple[float, float, float], tuple[float, float, float]]:
    s = VoluteSize(feature)
    return (0.0, 0.0, -s.outlet_length), (0.0, 0.0, -1.0)


def _loft(s: VoluteSize, extra: float) -> cq.Shape:
    """The scroll passage grown by `extra` mm all round."""
    wires = []
    n = SECTIONS
    for i in range(n):
        angle = FIRST_ANGLE_DEG + (360 - FIRST_ANGLE_DEG) * i / (n - 1)
        rho = s.rho(angle)
        a = math.radians(angle)
        centre = (s.cavity_r + rho) * math.cos(a), (s.cavity_r + rho) * math.sin(a), 0.0
        plane = cq.Plane(
            origin=centre,
            xDir=(math.cos(a), math.sin(a), 0.0),
            normal=(-math.sin(a), math.cos(a), 0.0),
        )
        wires.append(cq.Workplane(plane).circle(rho + extra).val())
    return cq.Solid.makeLoft(wires, False)  # type: ignore[arg-type]


def _stub(s: VoluteSize, radius: float) -> cq.Shape:
    base = cq.Vector(s.rc_max, -s.inlet_length, 0.0)
    return cq.Solid.makeCylinder(radius, s.inlet_length + 0.5, base, cq.Vector(0, 1, 0))


def build_volute(feature: Feature) -> tuple[cq.Shape, list[cq.Shape]]:
    """The housing's outer solid and the cutters that open its passages."""
    s = VoluteSize(feature)
    outer = _loft(s, s.wall).fuse(_stub(s, s.rho_max + s.wall))
    shroud = cq.Solid.makeCone(
        s.cavity_r + s.wall,
        s.exducer_r + s.wall,
        s.outlet_length,
        cq.Vector(0, 0, 0),
        cq.Vector(0, 0, -1),
    )
    outer = outer.fuse(shroud)
    z_cavity = s.rho_max + s.wall
    cavity = cq.Solid.makeCylinder(
        s.cavity_r + CAVITY_OVERLAP_MM, 2 * z_cavity, cq.Vector(0, 0, -z_cavity)
    )
    bore = cq.Solid.makeCylinder(
        s.exducer_r, s.outlet_length + 1, cq.Vector(0, 0, -s.outlet_length - 1)
    )
    passage = _loft(s, 0.0).fuse(_stub(s, s.rho_max))
    return outer.clean(), [passage, cavity, bore]


def check_volute(feature: Feature, anchors: Mapping[str, object], errors: list[str]) -> None:
    name = f"volute '{feature['id']}'"
    anchor = feature["placement"]["anchor"]
    if anchor != "origin" and anchor not in anchors:
        errors.append(f"{name}: anchor '{anchor}' was not provided")
    if float(feature["wall_thickness_mm"]) < MIN_WALL_MM:
        errors.append(f"{name}: wall_thickness_mm must be at least {MIN_WALL_MM:g} mm")
        return
    s = VoluteSize(feature)
    if s.outlet_length < s.min_outlet_length:
        errors.append(
            f"{name}: outlet_length_mm must be at least {s.min_outlet_length:.1f} mm "
            "to clear the scroll"
        )
    if s.exducer_r >= s.cavity_r:
        errors.append(f"{name}: exducer_diameter_mm must be smaller than the wheel cavity")
