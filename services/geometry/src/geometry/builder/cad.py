"""General CAD feature tree (Part Spec 4.0): sketches, extrude, revolve, boolean and transform.

Features run in the order listed, like a CAD program's history. Sketches are 2D shapes on a plane;
extrude and revolve make solids from them; booleans and transforms combine and move solids. A solid
that no later feature uses up is part of the result. All of it is plain data turned into geometry
by this module; nothing is evaluated as code.
"""

import math
from collections.abc import Sequence

import cadquery as cq

from geometry.builder.errors import SpecError
from geometry.builder.features import Feature

CAD_TYPES = ("sketch", "extrude", "revolve", "boolean", "transform")
SOLID_MAKERS = ("extrude", "revolve", "boolean", "transform")
PLANES = {
    "XY": ((1.0, 0.0, 0.0), (0.0, 0.0, 1.0)),
    "XZ": ((1.0, 0.0, 0.0), (0.0, -1.0, 0.0)),
    "YZ": ((0.0, 1.0, 0.0), (1.0, 0.0, 0.0)),
}
MIN_FEATURE_MM = 1e-6


def sketch_plane(spec: Feature) -> cq.Plane:
    x_dir, normal = PLANES[spec["name"]]
    ox, oy, oz = (float(v) for v in spec.get("origin_mm", (0, 0, 0)))
    off = float(spec.get("offset_mm", 0))
    return cq.Plane(
        origin=(ox + normal[0] * off, oy + normal[1] * off, oz + normal[2] * off),
        xDir=x_dir,
        normal=normal,
    )


def _pt(p: Sequence[float]) -> tuple[float, float]:
    return float(p[0]), float(p[1])


def _add_loop(wp: cq.Workplane, loop: Feature) -> cq.Workplane:
    """Add one closed outline to the workplane's pending wires."""
    kind = loop["kind"]
    cx, cy = _pt(loop.get("center_mm", (0, 0)))
    if kind == "circle":
        return wp.moveTo(cx, cy).circle(float(loop["diameter_mm"]) / 2)
    if kind == "rectangle":
        return wp.moveTo(cx, cy).rect(float(loop["width_mm"]), float(loop["height_mm"]))
    if kind == "ellipse":
        major, minor = float(loop["major_mm"]) / 2, float(loop["minor_mm"]) / 2
        return wp.moveTo(cx, cy).ellipse(
            major, minor, rotation_angle=float(loop.get("rotation_deg", 0))
        )
    if kind == "polygon":
        return wp.polyline([_pt(p) for p in loop["points_mm"]]).close()
    start = _pt(loop["start_mm"])
    wp = wp.moveTo(*start)
    for seg in loop["segments"]:
        if seg["kind"] == "line":
            wp = wp.lineTo(*_pt(seg["to_mm"]))
        elif seg["kind"] == "arc":
            wp = wp.threePointArc(_pt(seg["mid_mm"]), _pt(seg["to_mm"]))
        else:
            wp = wp.spline([_pt(p) for p in seg["through_mm"]], includeCurrent=True)
    return wp.close()


def _shape_workplanes(sketch: Feature) -> list[cq.Workplane]:
    """One workplane per sketch shape, with the outer outline and its holes as pending wires."""
    plane = sketch_plane(sketch["plane"])
    out = []
    for shape in sketch["shapes"]:
        wp = cq.Workplane(plane)
        wp = _add_loop(wp, shape["outer"])
        for hole in shape.get("holes", []):
            wp = _add_loop(wp, hole)
        out.append(wp)
    return out


def _solid_of(wp: cq.Workplane) -> cq.Shape:
    shape = wp.val()
    assert isinstance(shape, cq.Shape)
    return shape


def _fuse_all(shapes: list[cq.Shape]) -> cq.Shape:
    return shapes[0].fuse(*shapes[1:]).clean() if len(shapes) > 1 else shapes[0]


def make_extrude(sketch: Feature, feature: Feature) -> cq.Shape:
    distance = float(feature["distance_mm"])
    direction = feature.get("direction", "normal")
    taper = float(feature.get("taper_deg", 0))
    solids = []
    for wp in _shape_workplanes(sketch):
        if direction == "symmetric":
            solids.append(_solid_of(wp.extrude(distance / 2, both=True, taper=taper)))
        else:
            signed = distance if direction == "normal" else -distance
            solids.append(_solid_of(wp.extrude(signed, taper=taper)))
    return _fuse_all(solids)


def make_revolve(sketch: Feature, feature: Feature) -> cq.Shape:
    axis = feature.get("axis", {"from_mm": (0, 0), "to_mm": (0, 1)})
    a, b = _pt(axis["from_mm"]), _pt(axis["to_mm"])
    angle = float(feature.get("angle_deg", 360))
    solids = [_solid_of(wp.revolve(angle, a, b)) for wp in _shape_workplanes(sketch)]
    return _fuse_all(solids)


def _combine(operation: str, target: cq.Shape, tools: list[cq.Shape]) -> cq.Shape:
    if operation in ("union", "add"):
        return target.fuse(*tools).clean()
    if operation == "cut":
        return target.cut(*tools).clean()
    return target.intersect(*tools).clean()


def _move(shape: cq.Shape, feature: Feature) -> cq.Shape:
    if "mirror" in feature:
        m = feature["mirror"]
        name = m["plane"]
        normal = PLANES[name][1]
        off = float(m.get("offset_mm", 0))
        origin = (normal[0] * off, normal[1] * off, normal[2] * off)
        shape = shape.mirror(cq.Vector(*normal), cq.Vector(*origin))
    if "rotate" in feature:
        r = feature["rotate"]
        point = cq.Vector(*(float(v) for v in r["axis_point_mm"]))
        direction = cq.Vector(*(float(v) for v in r["axis_dir"]))
        shape = shape.rotate(point, point + direction, float(r["angle_deg"]))
    if "translate_mm" in feature:
        shape = shape.translate(cq.Vector(*(float(v) for v in feature["translate_mm"])))
    return shape


def check_cad(features: list[Feature], errors: list[str]) -> None:
    """Problems the schema cannot see: references, order and shape sanity, as plain sentences."""
    sketches: dict[str, Feature] = {}
    solids: set[str] = set()
    used: set[str] = set()

    def need_solid(owner: str, ref: str) -> bool:
        if ref in used:
            errors.append(f"{owner}: '{ref}' was already used up by an earlier feature")
            return False
        if ref not in solids:
            errors.append(f"{owner}: '{ref}' is not a solid made by an earlier feature")
            return False
        return True

    for f in features:
        name = f"{f['type']} '{f['id']}'"
        kind = f["type"]
        if kind == "sketch":
            for i, shape in enumerate(f["shapes"], start=1):
                for loop in [shape["outer"], *shape.get("holes", [])]:
                    _check_loop(f"{name}, shape {i}", loop, errors)
            sketches[f["id"]] = f
        elif kind in ("extrude", "revolve"):
            if f["sketch"] not in sketches:
                errors.append(f"{name}: '{f['sketch']}' is not a sketch made earlier in the spec")
            if f.get("operation", "new") != "new":
                if "target" not in f:
                    errors.append(f"{name}: operation '{f['operation']}' needs a 'target' solid")
                elif need_solid(name, f["target"]):
                    used.add(f["target"])
            elif "target" in f:
                errors.append(f"{name}: 'target' is only used with add, cut or intersect")
            sk = sketches.get(f["sketch"])
            if kind == "extrude" and f.get("taper_deg") and sk is not None:
                if any(shape.get("holes") for shape in sk["shapes"]):
                    errors.append(
                        f"{name}: taper_deg cannot be used on a sketch with holes; "
                        "extrude without taper, or cut the tapered holes separately"
                    )
            if kind == "revolve" and "axis" in f:
                if _pt(f["axis"]["from_mm"]) == _pt(f["axis"]["to_mm"]):
                    errors.append(f"{name}: the axis needs two different points")
            solids.add(f["id"])
        elif kind == "boolean":
            for ref in [f["target"], *f["tools"]]:
                if need_solid(name, ref):
                    used.add(ref)
            if f["target"] in f["tools"]:
                errors.append(f"{name}: the target cannot also be a tool")
            solids.add(f["id"])
        elif kind == "transform":
            if need_solid(name, f["source"]) and not f.get("copy", False):
                used.add(f["source"])
            if not any(k in f for k in ("translate_mm", "rotate", "mirror")):
                errors.append(f"{name}: needs translate_mm, rotate or mirror")
            if "rotate" in f and math.hypot(*(float(v) for v in f["rotate"]["axis_dir"])) < 1e-9:
                errors.append(f"{name}: rotate axis_dir cannot be [0, 0, 0]")
            solids.add(f["id"])


def _check_loop(where: str, loop: Feature, errors: list[str]) -> None:
    kind = loop["kind"]
    if kind == "polygon":
        pts = [_pt(p) for p in loop["points_mm"]]
        if len(set(pts)) < 3:
            errors.append(f"{where}: a polygon needs at least 3 different points")
        elif abs(_area(pts)) < MIN_FEATURE_MM:
            errors.append(f"{where}: the polygon has no area (its points are in a line)")
    elif kind == "ellipse" and float(loop["minor_mm"]) > float(loop["major_mm"]):
        errors.append(f"{where}: the ellipse minor_mm must not be larger than major_mm")
    elif kind == "path":
        here = _pt(loop["start_mm"])
        for seg in loop["segments"]:
            if seg["kind"] == "arc":
                a, m, b = here, _pt(seg["mid_mm"]), _pt(seg["to_mm"])
                if abs(_area([a, m, b])) < MIN_FEATURE_MM:
                    errors.append(f"{where}: an arc's three points are in a line; use a line")
                    return
                here = b
            elif seg["kind"] == "line":
                if _pt(seg["to_mm"]) == here:
                    errors.append(f"{where}: a line segment starts and ends at the same point")
                    return
                here = _pt(seg["to_mm"])
            else:
                here = _pt(seg["through_mm"][-1])


def _area(pts: list[tuple[float, float]]) -> float:
    return (
        sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1], strict=True))
        / 2
    )


def build_cad(features: list[Feature]) -> list[cq.Shape]:
    """Run the CAD features in order and return the solids nothing used up."""
    sketches: dict[str, Feature] = {}
    solids: dict[str, cq.Shape] = {}
    for f in features:
        kind = f["type"]
        if kind not in CAD_TYPES:
            continue
        try:
            if kind == "sketch":
                sketches[f["id"]] = f
                continue
            if kind in ("extrude", "revolve"):
                sketch = sketches[f["sketch"]]
                made = make_extrude(sketch, f) if kind == "extrude" else make_revolve(sketch, f)
                op = f.get("operation", "new")
                if op != "new":
                    made = _combine(op, solids.pop(f["target"]), [made])
            elif kind == "boolean":
                tools = [solids.pop(t) for t in f["tools"]]
                made = _combine(f["operation"], solids.pop(f["target"]), tools)
            else:
                source = solids[f["source"]] if f.get("copy") else solids.pop(f["source"])
                made = _move(source, f)
        except SpecError:
            raise
        except Exception as exc:  # the CAD kernel's own message is not readable to a user
            raise SpecError(
                [f"{kind} '{f['id']}' could not be built: {_kernel_reason(exc)}"]
            ) from exc
        if not made.isValid() or made.Volume() < MIN_FEATURE_MM:
            raise SpecError(
                [f"{kind} '{f['id']}' left no valid solid (it may have removed everything)"]
            )
        solids[f["id"]] = made
    return list(solids.values())


def _kernel_reason(exc: Exception) -> str:
    text = str(exc).strip()
    return text if text and len(text) < 160 else "check the sketch outline and the numbers used"
