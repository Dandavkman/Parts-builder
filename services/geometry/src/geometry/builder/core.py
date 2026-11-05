"""Turn a Part Spec into CadQuery geometry."""

from collections.abc import Mapping
from dataclasses import dataclass

import cadquery as cq

from geometry.builder import features as fx
from geometry.builder.bend import join_plates
from geometry.builder.body import build_body
from geometry.builder.cad import build_cad
from geometry.builder.checks import outline_points
from geometry.builder.errors import SpecError
from geometry.builder.pipework import build_flange, build_reducer
from geometry.builder.placement import Anchor, placement_location
from geometry.builder.spec_io import Spec, to_v1, validate_schema
from geometry.builder.text import apply_text
from geometry.builder.tube import build_tube
from geometry.builder.validate import check_spec, resolve_anchor
from geometry.builder.volute import build_volute

EDGE_FINISHES = ("fillet", "chamfer")
ADDITIONS = {"standoff": fx.apply_standoff_body, "rib": fx.apply_rib}
CUTS = {
    "hole": fx.apply_holes,
    "hole_pattern": fx.apply_holes,
    "slot": fx.apply_slot,
    "counterbore": fx.apply_counterbore,
    "countersink": fx.apply_countersink,
    "standoff": fx.apply_standoff_hole,
}


def _location(placement: fx.Feature, anchors: dict[str, Anchor]) -> cq.Location:
    x, y, z = placement.get("offset_mm", (0, 0, 0))
    return placement_location(
        resolve_anchor(placement["anchor"], anchors),
        (float(x), float(y), float(z)),
        float(placement.get("rotation_deg", 0)),
    )


def _build_plate(
    plate: fx.Feature,
    features: list[fx.Feature],
    plate_loc: cq.Location,
    anchors: dict[str, Anchor],
) -> cq.Workplane:
    own = [f for f in features if f.get("plate") == plate["id"]]
    solid = fx.build_plate(plate)
    for f in own:
        if f["type"] in EDGE_FINISHES:
            solid = fx.apply_edge_finish(solid, f)
    for f in own:
        if f["type"] in ADDITIONS:
            solid = ADDITIONS[f["type"]](solid, plate, f)
    for f in own:
        if f["type"] in CUTS:
            solid = CUTS[f["type"]](solid, plate, f)
        elif f["type"] == "cutout":
            solid = fx.apply_cutout(solid, f, _location(f["placement"], anchors), plate_loc)
    outline = outline_points(plate["outline"])
    for f in own:
        if f["type"] == "emboss_text":
            solid = apply_text(solid, plate, f, outline)
    return solid


@dataclass(frozen=True)
class HolePosition:
    """Where a drilled hole is on the placed part: center on the plate's top face, and its axis."""

    feature_id: str
    index: int
    center_mm: tuple[float, float, float]
    axis: tuple[float, float, float]
    diameter_mm: float


def hole_positions(spec: Spec, anchors: Mapping[str, Anchor] | None = None) -> list[HolePosition]:
    """Positions of every hole, pattern hole, counterbore, countersink and standoff bore.

    Holes on a plate that is bent on are left out for now (their frame depends on the bend).
    """
    anchors = dict(anchors or {})
    validate_schema(spec)
    v1 = to_v1(spec)
    check_spec(v1, anchors)
    plates = {f["id"]: f for f in v1["features"] if f["type"] == "plate"}
    bent_on = {f["to_plate"] for f in v1["features"] if f["type"] == "bend"}
    found: list[HolePosition] = []
    for f in v1["features"]:
        if f.get("plate") not in plates or f["plate"] in bent_on:
            continue
        if f["type"] in ("hole", "hole_pattern"):
            points, diameter = fx.hole_points(f), f["diameter_mm"]
        elif f["type"] in ("counterbore", "countersink"):
            points, diameter = [tuple(f["position_mm"])], f["diameter_mm"]
        elif f["type"] == "standoff" and f.get("hole_diameter_mm"):
            points, diameter = [tuple(f["position_mm"])], f["hole_diameter_mm"]
        else:
            continue
        plate = plates[f["plate"]]
        loc = _location(plate["placement"], anchors)
        top = float(plate["thickness_mm"]) / 2
        for i, (x, y) in enumerate(points, start=1):
            c = cq.Vertex.makeVertex(x, y, top).moved(loc).Center()
            tip = cq.Vertex.makeVertex(x, y, top + 1).moved(loc).Center()
            found.append(
                HolePosition(
                    f["id"], i, (c.x, c.y, c.z), (tip.x - c.x, tip.y - c.y, tip.z - c.z), diameter
                )
            )
    return found


def build_part(spec: Spec, anchors: Mapping[str, Anchor] | None = None) -> cq.Compound:
    """Build the part. Same spec and anchors always give the same geometry.

    Bodies (Part Spec 2.0) are built first: outline, edge fillet, then hollowing. Order is fixed.
    Per plate: fillets and chamfers, then additions (standoffs, ribs), then
    cuts (holes, patterns, slots, counterbores, countersinks, standoff bores, cutouts), then text,
    each group in spec order. Then bends fuse their to-plates onto their from-plates, and each
    plate moves onto its anchor. Raises SpecError with every problem found.
    """
    anchors = dict(anchors or {})
    validate_schema(spec)
    v1 = to_v1(spec)
    check_spec(v1, anchors)

    features = v1["features"]
    plates = {f["id"]: f for f in features if f["type"] == "plate"}
    bends = [f for f in features if f["type"] == "bend"]
    bent_on = {b["to_plate"] for b in bends}
    locations = {
        pid: _location(p["placement"], anchors) for pid, p in plates.items() if pid not in bent_on
    }
    solids = {
        pid: _build_plate(p, features, locations.get(pid, cq.Location()), anchors)
        for pid, p in plates.items()
    }
    for b in bends:
        solids[b["from_plate"]] = join_plates(
            solids[b["from_plate"]],
            solids[b["to_plate"]],
            plates[b["from_plate"]],
            plates[b["to_plate"]],
            b,
        )
    # Every older-style solid, by feature id, so CAD features (booleans, fillets, ...) can use them.
    legacy: dict[str, cq.Shape] = {}
    for body in (f for f in features if f["type"] == "body"):
        shape = build_body(body).val()
        assert isinstance(shape, cq.Shape)
        legacy[body["id"]] = shape.moved(_location(body["placement"], anchors))
    legacy.update(_build_tubes(features, anchors))
    for pid in plates:
        if pid not in bent_on:
            shape = solids[pid].val()
            assert isinstance(shape, cq.Shape)
            legacy[pid] = shape.moved(locations[pid])
    # Solids no CAD feature uses up are the part. Older solids keep their old order in the result.
    placed = build_cad(features, legacy)
    return cq.Compound.makeCompound(placed)


def _build_tubes(features: list[fx.Feature], anchors: dict[str, Anchor]) -> dict[str, cq.Shape]:
    """Placed solids by id for every tube, reducer and volute (flanges fused on) and every merge."""
    pieces: dict[str, tuple[cq.Shape, list[cq.Shape]]] = {}
    for f in features:
        if f["type"] not in ("tube", "reducer", "volute"):
            continue
        cuts: list[cq.Shape]
        if f["type"] == "volute":
            outer, cuts = build_volute(f)
        else:
            outer, bore = build_tube(f) if f["type"] == "tube" else build_reducer(f)
            cuts = [bore] if bore is not None else []
        for fl in (g for g in features if g["type"] == "flange" and g["tube"] == f["id"]):
            plate, holes = build_flange(fl, f)
            outer = outer.fuse(plate)
            cuts.extend(holes)
        loc = _location(f["placement"], anchors)
        pieces[f["id"]] = (outer.moved(loc), [c.moved(loc) for c in cuts])
    merged_ids = {t for f in features if f["type"] == "merge" for t in f["tubes"]}
    out = {
        pid: outer.cut(*cuts) if cuts else outer
        for pid, (outer, cuts) in pieces.items()
        if pid not in merged_ids
    }
    for f in features:
        if f["type"] != "merge":
            continue
        members = [pieces[t] for t in f["tubes"]]
        fused = members[0][0].fuse(*[m[0] for m in members[1:]])
        cuts = [c for m in members for c in m[1]]
        if cuts:
            fused = fused.cut(*cuts)
        fused = fused.clean()
        if len(fused.Solids()) != 1 or not fused.isValid():
            raise SpecError([f"merge '{f['id']}': the pieces do not overlap into one solid"])
        out[f["id"]] = fused
    return out
