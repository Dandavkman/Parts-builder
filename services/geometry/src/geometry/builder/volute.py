"""Turbine volute (Part Spec 3.2): a scroll housing sized from A/R, with an inlet and an outlet.

Frame: origin on the wheel axis at the wheel plane, Z along the axis, the exhaust outlet towards -Z.
The scroll starts at the tongue on the +X axis and winds counter-clockwise (seen from +Z) through
360 degrees. Its passage has a round section whose area grows linearly with the angle (so the
section radius grows as the square root of the angle), and its inner edge touches the wheel cavity.
The inlet is a straight stub on the last section, on the +X side, flowing in +Y and entering from
-Y. This is a simplified housing: no wastegate, no bearing flange, no nozzle vanes.

Part Spec 4.4 adds `channels` (1, 2 or 4): the circle is cut into that many equal sectors and each
channel is its own scroll over its sector, with its own tongue and its own tangential inlet stub at
the end of the sector. Each channel carries 1/N of the flow, so its A/R is the housing's divided by
N. The ends are then named inlet_1 .. inlet_N. `inlet_diameter_mm` sets the open end of the stubs.
"""

import math
from collections.abc import Mapping

import cadquery as cq

from geometry.builder.features import Feature

SECTIONS = 36
MIN_SECTIONS = 8
FIRST_ANGLE_DEG = 6.0
CAVITY_OVERLAP_MM = 0.3
MIN_WALL_MM = 1.0
OUTLET_MARGIN_MM = 10.0
OVERLAP_TOLERANCE_MM3 = 1.0


class VoluteSize:
    """The numbers every part of the volute is built from."""

    def __init__(self, feature: Feature) -> None:
        self.wall = float(feature["wall_thickness_mm"])
        self.cavity_r = float(feature["inducer_diameter_mm"]) / 2 + float(
            feature.get("tongue_clearance_mm", 2)
        )
        self.channels = int(feature.get("channels", 1))
        # A/R in cm is area (cm2) over radius (cm); each channel carries 1/N of the flow.
        k = float(feature["a_over_r_cm"]) * 10 / self.channels
        # Area pi*rho^2 over centroid radius (cavity_r + rho) equals k: solve for rho.
        self.rho_max = (k + math.sqrt(k * k + 4 * math.pi * k * self.cavity_r)) / (2 * math.pi)
        self.rc_max = self.cavity_r + self.rho_max
        self.inlet_length = float(feature.get("inlet_length_mm", 30))
        self.outlet_length = float(feature.get("outlet_length_mm", 60))
        self.exducer_r = float(feature["exducer_diameter_mm"]) / 2
        inlet_d = feature.get("inlet_diameter_mm")
        self.inlet_r = float(inlet_d) / 2 if inlet_d is not None else self.rho_max
        self.sector_deg = 360.0 / self.channels

    def rho(self, local_deg: float) -> float:
        """Section radius at an angle measured from the channel's own tongue."""
        return self.rho_max * math.sqrt(local_deg / self.sector_deg)

    def end_angle(self, channel: int) -> float:
        """Angle (degrees) where channel 0, 1, ... ends and its inlet stub sits."""
        return (channel + 1) * self.sector_deg

    @property
    def inlet_names(self) -> list[str]:
        if self.channels == 1:
            return ["inlet"]
        return [f"inlet_{i + 1}" for i in range(self.channels)]

    @property
    def inlet_outer_diameter(self) -> float:
        return 2 * (self.inlet_r + self.wall)

    @property
    def min_outlet_length(self) -> float:
        return self.rho_max + self.wall + OUTLET_MARGIN_MM


def _stub_geometry(
    s: VoluteSize, channel: int
) -> tuple[tuple[float, float, float], tuple[float, float, float]]:
    """Where channel's stub meets the scroll, and the direction the flow takes there."""
    a = math.radians(s.end_angle(channel))
    point = (s.rc_max * math.cos(a), s.rc_max * math.sin(a), 0.0)
    return point, (-math.sin(a), math.cos(a), 0.0)


def inlet_ends(
    feature: Feature,
) -> dict[str, tuple[tuple[float, float, float], tuple[float, float, float]]]:
    """For every inlet: the open end of its stub and the outward direction."""
    s = VoluteSize(feature)
    out = {}
    for i, name in enumerate(s.inlet_names):
        (px, py, pz), (tx, ty, tz) = _stub_geometry(s, i)
        far = (px - tx * s.inlet_length, py - ty * s.inlet_length, pz)
        out[name] = (far, (-tx, -ty, -tz))
    return out


def outlet_end(feature: Feature) -> tuple[tuple[float, float, float], tuple[float, float, float]]:
    s = VoluteSize(feature)
    return (0.0, 0.0, -s.outlet_length), (0.0, 0.0, -1.0)


def _loft(s: VoluteSize, extra: float, channel: int) -> cq.Shape:
    """One channel's passage grown by `extra` mm all round."""
    start = channel * s.sector_deg
    first = min(FIRST_ANGLE_DEG, s.sector_deg / 10)
    wires = []
    n = max(MIN_SECTIONS, round(SECTIONS * s.sector_deg / 360))  # about 10 degrees apart
    for i in range(n):
        local = first + (s.sector_deg - first) * i / (n - 1)
        rho = s.rho(local)
        a = math.radians(start + local)
        centre = (s.cavity_r + rho) * math.cos(a), (s.cavity_r + rho) * math.sin(a), 0.0
        plane = cq.Plane(
            origin=centre,
            xDir=(math.cos(a), math.sin(a), 0.0),
            normal=(-math.sin(a), math.cos(a), 0.0),
        )
        wires.append(cq.Workplane(plane).circle(rho + extra).val())
    return cq.Solid.makeLoft(wires, False)  # type: ignore[arg-type]


def _stub(s: VoluteSize, extra: float, channel: int) -> cq.Shape:
    """The inlet stub of one channel, `extra` mm bigger all round than the passage."""
    (px, py, pz), (tx, ty, tz) = _stub_geometry(s, channel)
    base = cq.Vector(px - tx * s.inlet_length, py - ty * s.inlet_length, pz)
    direction = cq.Vector(tx, ty, tz)
    length = s.inlet_length + 0.5
    if s.inlet_r != s.rho_max:
        return cq.Solid.makeCone(s.inlet_r + extra, s.rho_max + extra, length, base, direction)
    return cq.Solid.makeCylinder(s.rho_max + extra, length, base, direction)


def channel_passages(s: VoluteSize) -> list[cq.Shape]:
    return [_loft(s, 0.0, i).fuse(_stub(s, 0.0, i)) for i in range(s.channels)]


def build_volute(feature: Feature) -> tuple[cq.Shape, list[cq.Shape]]:
    """The housing's outer solid and the cutters that open its passages."""
    s = VoluteSize(feature)
    outer = _loft(s, s.wall, 0).fuse(_stub(s, s.wall, 0))
    for i in range(1, s.channels):
        outer = outer.fuse(_loft(s, s.wall, i), _stub(s, s.wall, i))
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
    return outer.clean(), [*channel_passages(s), cavity, bore]


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
    if s.channels > 1:
        passages = channel_passages(s)
        for i in range(len(passages)):
            for j in range(i + 1, len(passages)):
                shared = passages[i].intersect(passages[j])
                if shared.Volume() > OVERLAP_TOLERANCE_MM3:
                    errors.append(
                        f"{name}: channels {i + 1} and {j + 1} run into each other "
                        "(shorten inlet_length_mm, reduce inlet_diameter_mm, or use fewer channels)"
                    )
