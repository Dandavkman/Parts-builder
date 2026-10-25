"""Checks the schema cannot make: ids, references, anchors and whether features fit the plate."""

from geometry.builder.checks import circle_fits, outline_points
from geometry.builder.errors import SpecError
from geometry.builder.features import Feature, hole_points, slot_end_centers
from geometry.builder.placement import ORIGIN, Anchor
from geometry.builder.spec_io import Spec

SUPPORTED = {"plate", "hole", "hole_pattern", "slot", "fillet", "chamfer"}


def check_spec(spec: Spec, anchors: dict[str, Anchor]) -> None:
    """Raise a SpecError listing every problem in a v1-shaped spec."""
    errors: list[str] = []
    seen: dict[str, Feature] = {}
    for f in spec["features"]:
        if f["id"] in seen:
            errors.append(f"feature id '{f['id']}' is used more than once")
        seen[f["id"]] = f
        if f["type"] not in SUPPORTED:
            errors.append(f"{f['type']} '{f['id']}': this feature type is not buildable yet")
    for f in spec["features"]:
        if f["type"] == "plate":
            name = f["placement"]["anchor"]
            if name != "origin" and name not in anchors:
                errors.append(f"plate '{f['id']}': anchor '{name}' was not provided")
            o = f["outline"]
            if (
                o["kind"] == "rectangle"
                and o.get("corner_radius_mm", 0) > min(o["width_mm"], o["length_mm"]) / 2
            ):
                errors.append(
                    f"plate '{f['id']}': corner_radius_mm is larger than half the shorter side"
                )
            continue
        plate = seen.get(f["plate"])
        if plate is None or plate["type"] != "plate":
            errors.append(f"{f['type']} '{f['id']}': '{f['plate']}' is not a plate in this spec")
            continue
        poly = outline_points(plate["outline"])
        if f["type"] in ("hole", "hole_pattern"):
            for n, (x, y) in enumerate(hole_points(f), start=1):
                if not circle_fits((x, y), f["diameter_mm"] / 2, poly):
                    where = (
                        f"hole {n} of '{f['id']}'"
                        if f["type"] == "hole_pattern"
                        else f"hole '{f['id']}'"
                    )
                    errors.append(f"{where} at [{x:g}, {y:g}] mm is outside plate '{f['plate']}'")
        elif f["type"] == "slot":
            if not all(circle_fits(c, f["width_mm"] / 2, poly) for c in slot_end_centers(f)):
                errors.append(f"slot '{f['id']}' is outside plate '{f['plate']}'")
            if f["length_mm"] < f["width_mm"]:
                errors.append(f"slot '{f['id']}': length_mm must be at least width_mm")
        elif f["type"] in ("fillet", "chamfer"):
            pass
    if errors:
        raise SpecError(errors)


def resolve_anchor(name: str, anchors: dict[str, Anchor]) -> Anchor:
    return ORIGIN if name == "origin" else anchors[name]
