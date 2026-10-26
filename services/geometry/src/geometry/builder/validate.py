"""Checks the schema cannot make: ids, references, anchors and whether features fit the plate."""

from geometry.builder.bend import edge_dims_mm
from geometry.builder.checks import circle_fits, outline_points
from geometry.builder.errors import SpecError
from geometry.builder.features import (
    Feature,
    countersink_depth_mm,
    hole_points,
    slot_end_centers,
)
from geometry.builder.placement import ORIGIN, Anchor
from geometry.builder.spec_io import Spec

ON_PLATE = {
    "hole", "hole_pattern", "slot", "counterbore", "countersink", "standoff", "rib",
    "fillet", "chamfer", "cutout", "emboss_text",
}  # fmt: skip


def check_spec(spec: Spec, anchors: dict[str, Anchor]) -> None:
    """Raise a SpecError listing every problem in a v1-shaped spec."""
    errors: list[str] = []
    seen: dict[str, Feature] = {}
    for f in spec["features"]:
        if f["id"] in seen:
            errors.append(f"feature id '{f['id']}' is used more than once")
        seen[f["id"]] = f
    bent_on = _check_bends(spec, seen, errors)
    for f in spec["features"]:
        if f["type"] == "plate":
            _check_plate(f, anchors, errors, placed=f["id"] not in bent_on)
        elif f["type"] in ON_PLATE:
            plate = seen.get(f["plate"])
            if plate is None or plate["type"] != "plate":
                errors.append(
                    f"{f['type']} '{f['id']}': '{f['plate']}' is not a plate in this spec"
                )
            else:
                _check_on_plate(f, plate, anchors, errors, bent_on)
    if errors:
        raise SpecError(errors)


def _check_plate(f: Feature, anchors: dict[str, Anchor], errors: list[str], placed: bool) -> None:
    name = f["placement"]["anchor"]
    if placed and name != "origin" and name not in anchors:
        errors.append(f"plate '{f['id']}': anchor '{name}' was not provided")
    o = f["outline"]
    if (
        o["kind"] == "rectangle"
        and o.get("corner_radius_mm", 0) > min(o["width_mm"], o["length_mm"]) / 2
    ):
        errors.append(f"plate '{f['id']}': corner_radius_mm is larger than half the shorter side")


def _check_bends(spec: Spec, seen: dict[str, Feature], errors: list[str]) -> set[str]:
    """Check every bend; return ids of plates that are bent on (their own placement is ignored)."""
    bent_on: set[str] = set()
    bends = [f for f in spec["features"] if f["type"] == "bend"]
    for b in bends:
        name = f"bend '{b['id']}'"
        src, dst = seen.get(b["from_plate"]), seen.get(b["to_plate"])
        if src is None or src["type"] != "plate" or dst is None or dst["type"] != "plate":
            errors.append(f"{name}: from_plate and to_plate must both be plates in this spec")
            continue
        if src is dst:
            errors.append(f"{name}: a plate cannot be bent onto itself")
            continue
        if b["to_plate"] in bent_on:
            errors.append(
                f"{name}: plate '{b['to_plate']}' is already the to_plate of another bend"
            )
        bent_on.add(b["to_plate"])
        if any(
            p["outline"]["kind"] != "rectangle" or p["outline"].get("corner_radius_mm", 0)
            for p in (src, dst)
        ):
            errors.append(
                f"{name}: bends need plain rectangle plates (no polygon or rounded corners)"
            )
            continue
        if src["thickness_mm"] != dst["thickness_mm"]:
            errors.append(f"{name}: both plates must have the same thickness_mm")
        a, c = edge_dims_mm(src, b["from_edge"])[1], edge_dims_mm(dst, b["to_edge"])[1]
        if abs(a - c) > 1e-6:
            errors.append(f"{name}: the joined edges differ in length ({a:g} mm and {c:g} mm)")
    for b in bends:
        if b["from_plate"] in bent_on:
            errors.append(
                f"bend '{b['id']}': plate '{b['from_plate']}' is bent on by another bend; "
                "chains are not supported"
            )
    return bent_on


def _check_on_plate(
    f: Feature, plate: Feature, anchors: dict[str, Anchor], errors: list[str], bent_on: set[str]
) -> None:
    poly = outline_points(plate["outline"])
    kind, pid, t = f["type"], f["plate"], float(plate["thickness_mm"])

    def fits(point: tuple[float, float], diameter: float) -> bool:
        return circle_fits(point, diameter / 2, poly)

    if kind in ("hole", "hole_pattern"):
        for n, (x, y) in enumerate(hole_points(f), start=1):
            if not fits((x, y), f["diameter_mm"]):
                where = (
                    f"hole {n} of '{f['id']}'" if kind == "hole_pattern" else f"hole '{f['id']}'"
                )
                errors.append(f"{where} at [{x:g}, {y:g}] mm is outside plate '{pid}'")
    elif kind == "slot":
        if not all(circle_fits(c, f["width_mm"] / 2, poly) for c in slot_end_centers(f)):
            errors.append(f"slot '{f['id']}' is outside plate '{pid}'")
        if f["length_mm"] < f["width_mm"]:
            errors.append(f"slot '{f['id']}': length_mm must be at least width_mm")
    elif kind == "counterbore":
        if f["bore_diameter_mm"] <= f["diameter_mm"]:
            errors.append(
                f"counterbore '{f['id']}': bore_diameter_mm must be larger than diameter_mm"
            )
        if f["bore_depth_mm"] >= t:
            errors.append(
                f"counterbore '{f['id']}': bore_depth_mm must be less than the plate "
                f"thickness ({t:g} mm)"
            )
        if not fits(f["position_mm"], max(f["bore_diameter_mm"], f["diameter_mm"])):
            errors.append(f"counterbore '{f['id']}' is outside plate '{pid}'")
    elif kind == "countersink":
        if f["sink_diameter_mm"] <= f["diameter_mm"]:
            errors.append(
                f"countersink '{f['id']}': sink_diameter_mm must be larger than diameter_mm"
            )
        elif countersink_depth_mm(f) >= t:
            errors.append(
                f"countersink '{f['id']}': the cone is deeper than the plate thickness ({t:g} mm)"
            )
        if not fits(f["position_mm"], max(f["sink_diameter_mm"], f["diameter_mm"])):
            errors.append(f"countersink '{f['id']}' is outside plate '{pid}'")
    elif kind == "standoff":
        if not fits(f["position_mm"], f["outer_diameter_mm"]):
            errors.append(f"standoff '{f['id']}' is outside plate '{pid}'")
        if f.get("hole_diameter_mm", 0) >= f["outer_diameter_mm"]:
            errors.append(
                f"standoff '{f['id']}': hole_diameter_mm must be less than outer_diameter_mm"
            )
    elif kind == "rib":
        if f["start_mm"] == f["end_mm"]:
            errors.append(f"rib '{f['id']}': start_mm and end_mm are the same point")
        if not all(fits(p, f["thickness_mm"]) for p in (f["start_mm"], f["end_mm"])):
            errors.append(f"rib '{f['id']}' is outside plate '{pid}'")
    elif kind == "cutout":
        name = f["placement"]["anchor"]
        if name != "origin" and name not in anchors:
            errors.append(f"cutout '{f['id']}': anchor '{name}' was not provided")
        if pid in bent_on:
            errors.append(
                f"cutout '{f['id']}': cutouts are not supported on plate '{pid}', which is bent on"
            )


def resolve_anchor(name: str, anchors: dict[str, Anchor]) -> Anchor:
    return ORIGIN if name == "origin" else anchors[name]
