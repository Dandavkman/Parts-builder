"""Turn a Part Spec into CadQuery geometry."""

from collections.abc import Mapping

import cadquery as cq

from geometry.builder import features as fx
from geometry.builder.placement import Anchor, placement_location
from geometry.builder.spec_io import Spec, to_v1, validate_schema
from geometry.builder.validate import check_spec, resolve_anchor

EDGE_FINISHES = ("fillet", "chamfer")
CUTS = {"hole": fx.apply_holes, "hole_pattern": fx.apply_holes, "slot": fx.apply_slot}


def build_part(spec: Spec, anchors: Mapping[str, Anchor] | None = None) -> cq.Compound:
    """Build the part. Same spec and anchors always give the same geometry.

    Order is fixed: each plate, then its fillets and chamfers, then its cuts, each group in spec
    order, then the plate moves onto its anchor. Raises SpecError with every problem found.
    """
    anchors = dict(anchors or {})
    validate_schema(spec)
    v1 = to_v1(spec)
    check_spec(v1, anchors)

    features = v1["features"]
    solids: list[cq.Shape] = []
    for plate in (f for f in features if f["type"] == "plate"):
        own = [f for f in features if f.get("plate") == plate["id"]]
        solid = fx.build_plate(plate)
        for f in own:
            if f["type"] in EDGE_FINISHES:
                solid = fx.apply_edge_finish(solid, f)
        for f in own:
            if f["type"] in CUTS:
                solid = CUTS[f["type"]](solid, plate, f)
        place = plate["placement"]
        loc = placement_location(
            resolve_anchor(place["anchor"], anchors),
            tuple(place.get("offset_mm", (0, 0, 0))),
            place.get("rotation_deg", 0),
        )
        shape = solid.val()
        assert isinstance(shape, cq.Shape)
        solids.append(shape.moved(loc))
    return cq.Compound.makeCompound(solids)
