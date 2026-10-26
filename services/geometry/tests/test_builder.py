"""Builder tests. Golden files in tests/golden hold a geometry summary per spec; regenerate them
with `UPDATE_GOLDEN=1 uv run pytest tests/test_builder.py` and review the diff."""

import copy
import json
import os
from pathlib import Path
from typing import Any

import cadquery as cq
import pytest

from geometry.builder import Anchor, SpecError, build_part, export_bytes

SPEC_DIR = Path(__file__).parent.parent / "src" / "geometry" / "spec"
GOLDEN_DIR = Path(__file__).parent / "golden"
BUILDABLE = [
    "hole",
    "hole-pattern",
    "slot",
    "fillet",
    "chamfer",
    "plate-polygon",
    "plate-rounded-rectangle",
    "counterbore",
    "countersink",
    "standoff",
    "rib",
    "gusset",
    "bend",
    "cutout",
    "emboss-text",
]
ANCHORS = {
    "fender_bolt": Anchor((100.0, 50.0, 20.0), (0.0, 1.0, 0.0)),
    "hose_clamp": Anchor((5.0, 3.0, 0.0)),
}


def _example(name: str) -> dict[str, Any]:
    return copy.deepcopy(json.loads((SPEC_DIR / "examples" / "v1" / f"{name}.json").read_text()))


def _summary(shape: cq.Shape) -> dict[str, Any]:
    bb = shape.BoundingBox()
    return {
        "volume_mm3": round(shape.Volume(), 2),
        "bbox_mm": [round(v, 3) for v in (bb.xmin, bb.xmax, bb.ymin, bb.ymax, bb.zmin, bb.zmax)],
        "faces": len(shape.Faces()),
        "solids": len(shape.Solids()),
    }


@pytest.mark.parametrize("name", BUILDABLE)
def test_golden(name: str) -> None:
    summary = _summary(build_part(_example(name), ANCHORS))
    path = GOLDEN_DIR / f"{name}.json"
    if os.environ.get("UPDATE_GOLDEN"):
        path.write_text(json.dumps(summary, indent=2) + "\n")
    expected = json.loads(path.read_text())
    assert summary["faces"] == expected["faces"]
    assert summary["solids"] == expected["solids"]
    assert summary["volume_mm3"] == pytest.approx(expected["volume_mm3"], abs=0.05)
    assert summary["bbox_mm"] == pytest.approx(expected["bbox_mm"], abs=0.001)


@pytest.mark.parametrize("fmt", ["step", "stl", "glb"])
@pytest.mark.parametrize("name", ["hole-pattern", "bend", "emboss-text"])
def test_same_spec_gives_same_bytes(fmt: str, name: str) -> None:
    first = export_bytes(build_part(_example(name), ANCHORS), fmt)
    second = export_bytes(build_part(_example(name), ANCHORS), fmt)
    assert first == second
    assert len(first) > 100


def test_hole_is_where_the_spec_says() -> None:
    spec = _example("hole")
    spec["features"][1]["position_mm"] = [10, -5]
    part = build_part(spec)
    cylinders = [f for f in part.Faces() if f.geomType() == "CYLINDER"]
    assert len(cylinders) == 1
    center = cylinders[0].Center()
    assert (center.x, center.y) == pytest.approx((10, -5), abs=1e-6)
    assert cylinders[0].BoundingBox().xlen == pytest.approx(6.5, abs=1e-6)


def test_hole_pattern_positions() -> None:
    spec = _example("hole-pattern")
    spec["features"][1]["pattern"] = {
        "kind": "rectangular", "center_mm": [5, 0], "count_x": 2, "count_y": 2,
        "spacing_x_mm": 20, "spacing_y_mm": 10,
    }  # fmt: skip
    centers = sorted(
        (round(f.Center().x, 3), round(f.Center().y, 3))
        for f in build_part(spec).Faces()
        if f.geomType() == "CYLINDER"
    )
    assert centers == [(-5, -5), (-5, 5), (15, -5), (15, 5)]


def test_slot_is_end_to_end_length() -> None:
    spec = _example("slot")
    spec["features"][1]["angle_deg"] = 90
    part = build_part(spec)
    slot_faces = [f for f in part.Faces() if f.geomType() != "PLANE"]
    bb = slot_faces[0].BoundingBox()
    ymin = min(f.BoundingBox().ymin for f in slot_faces)
    ymax = max(f.BoundingBox().ymax for f in slot_faces)
    assert ymax - ymin == pytest.approx(24, abs=1e-6)
    assert bb.xlen <= 6.5 + 1e-6


def test_placement_follows_anchor_offset_and_rotation() -> None:
    spec = _example("plate-polygon")
    bb = build_part(spec, ANCHORS).BoundingBox()
    # Normal +Y: the 4 mm plate runs along Y, centered 2 mm out from the anchor.
    assert (bb.ymin, bb.ymax) == pytest.approx((50, 54), abs=1e-6)


def test_v01_specs_still_build() -> None:
    spec = json.loads((SPEC_DIR / "examples" / "plate-with-hole-patterns.json").read_text())
    shape = build_part(spec)
    bb = shape.BoundingBox()
    assert (bb.xlen, bb.ylen, bb.zlen) == pytest.approx((80, 60, 5), abs=1e-6)
    assert len([f for f in shape.Faces() if f.geomType() == "CYLINDER"]) == 4 + 6


def test_multiple_plates_build_as_separate_solids() -> None:
    spec = _example("hole")
    second = copy.deepcopy(spec["features"][0])
    second["id"] = "other"
    second["placement"] = {"anchor": "origin", "offset_mm": [100, 0, 0]}
    spec["features"].append(second)
    assert len(build_part(spec).Solids()) == 2


def test_fillet_too_large_is_a_clear_error() -> None:
    spec = _example("fillet")
    spec["features"][1]["radius_mm"] = 200
    with pytest.raises(SpecError, match=r"fillet 'fillet_1'.*does not fit on plate 'base'"):
        build_part(spec)


def _error(spec: dict[str, Any]) -> str:
    with pytest.raises(SpecError) as info:
        build_part(spec)
    return str(info.value)


def test_hole_outside_plate() -> None:
    spec = _example("hole")
    spec["features"][1]["position_mm"] = [29, 0]
    assert "hole 'hole_1' at [29, 0] mm is outside plate 'base'" in _error(spec)


def test_pattern_hole_outside_plate_names_the_hole() -> None:
    spec = _example("hole-pattern")
    spec["features"][1]["pattern"]["radius_mm"] = 25
    assert "of 'ring' at" in _error(spec)


def test_unknown_plate_duplicate_id_and_missing_anchor() -> None:
    spec = _example("hole")
    spec["features"][1]["plate"] = "nope"
    spec["features"].append(copy.deepcopy(spec["features"][0]))
    spec["features"][0]["placement"]["anchor"] = "missing"
    message = _error(spec)
    assert "'nope' is not a plate" in message
    assert "'base' is used more than once" in message
    assert "anchor 'missing' was not provided" in message


def test_schema_errors_and_unsupported_features() -> None:
    spec = _example("hole")
    del spec["features"][1]["diameter_mm"]
    assert "diameter_mm" in _error(spec)
    assert "spec_version" in _error({"spec_version": "9.9", "name": "x", "features": []})


def test_slot_outside_plate() -> None:
    spec = _example("slot")
    spec["features"][1]["position_mm"] = [25, 0]
    assert "slot 'slot_1' is outside plate 'base'" in _error(spec)


def _plate_volume(spec: dict[str, Any]) -> float:
    plate = spec["features"][0]
    return float(
        plate["outline"]["width_mm"] * plate["outline"]["length_mm"] * plate["thickness_mm"]
    )


def test_counterbore_recess_is_on_top_face() -> None:
    spec = _example("counterbore")
    f = spec["features"][1]
    part = build_part(spec)
    bore = [
        x
        for x in part.Faces()
        if x.geomType() == "CYLINDER" and x.BoundingBox().xlen > f["diameter_mm"] + 1
    ]
    assert len(bore) == 1
    bb = bore[0].BoundingBox()
    assert bb.xlen == pytest.approx(f["bore_diameter_mm"], abs=1e-6)
    assert (bb.zmin, bb.zmax) == pytest.approx((2 - f["bore_depth_mm"], 2), abs=1e-6)


def test_countersink_cone_has_the_requested_angle_and_diameter() -> None:
    spec = _example("countersink")
    f = spec["features"][1]
    cone = next(x for x in build_part(spec).Faces() if x.geomType() == "CONE")
    bb = cone.BoundingBox()
    assert bb.xlen == pytest.approx(f["sink_diameter_mm"], abs=1e-6)
    assert bb.zmax == pytest.approx(2, abs=1e-6)
    depth = (f["sink_diameter_mm"] - f["diameter_mm"]) / 2  # 90 degree cone
    assert bb.zmin == pytest.approx(2 - depth, abs=1e-6)


@pytest.mark.parametrize("face, z_range", [("top", (-2, 12)), ("bottom", (-12, 2))])
def test_standoff_grows_from_the_chosen_face(face: str, z_range: tuple[float, float]) -> None:
    spec = _example("standoff")
    spec["features"][1]["face"] = face
    bb = build_part(spec).BoundingBox()
    assert (bb.zmin, bb.zmax) == pytest.approx(z_range, abs=1e-6)
    holes = [
        x
        for x in build_part(spec).Faces()
        if x.geomType() == "CYLINDER" and x.BoundingBox().xlen < 4
    ]
    assert holes[0].BoundingBox().zlen == pytest.approx(14, abs=1e-6)


def test_rib_and_gusset_volumes() -> None:
    rib = _example("rib")
    assert build_part(rib).Volume() == pytest.approx(_plate_volume(rib) + 40 * 2 * 8, abs=0.01)
    gusset = _example("gusset")
    assert build_part(gusset).Volume() == pytest.approx(
        _plate_volume(gusset) + 0.5 * 30 * 12 * 3, abs=0.01
    )


def test_rib_on_bottom_face_and_diagonal() -> None:
    spec = _example("rib")
    spec["features"][1].update({"face": "bottom", "start_mm": [-10, -10], "end_mm": [10, 10]})
    part = build_part(spec)
    assert part.BoundingBox().zmin == pytest.approx(-10, abs=1e-6)
    assert part.Volume() == pytest.approx(_plate_volume(spec) + 28.2842712 * 2 * 8, abs=0.01)


@pytest.mark.parametrize("angle, radius", [(90, 3), (45, 0), (135, 5), (90, 0)])
@pytest.mark.parametrize("edges", [("+y", "-y"), ("-y", "+y"), ("+x", "-x"), ("-x", "+x")])
def test_bend_volume_is_plates_plus_bend(angle: int, radius: float, edges: tuple[str, str]) -> None:
    import math

    spec = _example("bend")
    spec["features"][0]["outline"] = {"kind": "rectangle", "width_mm": 50, "length_mm": 50}
    along_y = edges[0] in ("+y", "-y")  # the leg's edge is 50 mm long, its other side 40 mm
    spec["features"][1]["outline"] = {
        "kind": "rectangle",
        "width_mm": 50 if along_y else 40,
        "length_mm": 40 if along_y else 50,
    }
    spec["features"][2].update(
        {"angle_deg": angle, "inner_radius_mm": radius, "from_edge": edges[0], "to_edge": edges[1]}
    )
    part = build_part(spec)
    t = 3
    bend = math.radians(angle) / 2 * ((radius + t) ** 2 - radius**2) * 50
    assert len(part.Solids()) == 1
    assert part.Volume() == pytest.approx(50 * 50 * t + 50 * 40 * t + bend, abs=0.05)


def test_bend_leg_ends_where_expected() -> None:
    bb = build_part(_example("bend")).BoundingBox()  # 90 degree bend, inner radius 3, 3 mm plates
    assert (bb.ymax, bb.zmax) == pytest.approx((21, 44.5), abs=1e-6)


def test_bent_on_plate_features_follow_the_plate() -> None:
    spec = _example("bend")
    spec["features"].append(
        {"id": "h", "type": "hole", "plate": "leg", "diameter_mm": 6, "position_mm": [0, 0]}
    )
    holes = [
        x
        for x in build_part(spec).Faces()
        if x.geomType() == "CYLINDER" and x.BoundingBox().xlen < 7
    ]
    assert len(holes) == 1
    # The leg's middle is 20 mm along it, from the bend end at z = 4.5.
    assert holes[0].Center().z == pytest.approx(24.5, abs=1e-6)


def test_cutout_is_centered_on_its_anchor() -> None:
    spec = _example("cutout")
    cut = [x.BoundingBox() for x in build_part(spec, ANCHORS).Faces() if x.geomType() == "CYLINDER"]
    assert cut
    assert (min(b.xmin for b in cut), max(b.xmax for b in cut)) == pytest.approx((-5, 15), abs=1e-6)
    assert (min(b.ymin for b in cut), max(b.ymax for b in cut)) == pytest.approx((-7, 13), abs=1e-6)


def test_cutout_follows_a_placed_plate() -> None:
    spec = _example("cutout")
    spec["features"][0]["placement"] = {"anchor": "origin", "offset_mm": [100, 0, 0]}
    with pytest.raises(SpecError, match="does not touch plate 'base'"):
        build_part(spec, ANCHORS)  # the zone at (5, 3) is now 100 mm from the plate


def test_cutout_rectangle_zone() -> None:
    spec = _example("cutout")
    spec["features"][1]["zone"] = {"kind": "rectangle", "width_mm": 10, "length_mm": 6}
    spec["features"][1]["margin_mm"] = 1
    assert build_part(spec, ANCHORS).Volume() == pytest.approx(
        _plate_volume(spec) - 12 * 8 * 4, abs=0.01
    )


def test_text_height_and_raised_vs_engraved() -> None:
    raised = _example("emboss-text")
    bb = build_part(raised).BoundingBox()
    assert bb.zmax == pytest.approx(2.8, abs=1e-6)
    engraved = copy.deepcopy(raised)
    engraved["features"][1]["mode"] = "engraved"
    assert build_part(engraved).Volume() < _plate_volume(raised) < build_part(raised).Volume()
    assert build_part(engraved).BoundingBox().zmax == pytest.approx(2, abs=1e-6)
    # Capital letter height is height_mm: measure the added material in Y.
    letters = [x for x in build_part(raised).Faces() if x.BoundingBox().zmin > 2.7]
    ys = [v for x in letters for v in (x.BoundingBox().ymin, x.BoundingBox().ymax)]
    assert max(ys) - min(ys) == pytest.approx(8, abs=0.4)


def test_text_on_bottom_face_and_outside_plate() -> None:
    spec = _example("emboss-text")
    spec["features"][1]["face"] = "bottom"
    assert build_part(spec).BoundingBox().zmin == pytest.approx(-2.8, abs=1e-6)
    spec["features"][1]["position_mm"] = [28, 0]
    assert "text 'label' extends past the edge of plate 'base'" in _error(spec)


def test_new_feature_errors_are_clear() -> None:
    cb = _example("counterbore")
    cb["features"][1]["bore_depth_mm"] = 4
    assert "bore_depth_mm must be less than the plate thickness" in _error(cb)
    cs = _example("countersink")
    cs["features"][1]["sink_diameter_mm"] = 20
    assert "the cone is deeper than the plate thickness" in _error(cs)
    so = _example("standoff")
    so["features"][1]["position_mm"] = [28, 0]
    assert "standoff 'post_1' is outside plate 'base'" in _error(so)
    rib = _example("rib")
    rib["features"][1]["end_mm"] = [40, 0]
    assert "rib 'rib_1' is outside plate 'base'" in _error(rib)
    cut = _example("cutout")
    assert "anchor 'hose_clamp' was not provided" in _error(cut)
    far = _example("cutout")
    far["features"][1]["placement"]["offset_mm"] = [500, 0, 0]
    with pytest.raises(SpecError, match="does not touch plate 'base'"):
        build_part(far, ANCHORS)


def test_bend_errors_are_clear() -> None:
    thick = _example("bend")
    thick["features"][1]["thickness_mm"] = 4
    assert "same thickness_mm" in _error(thick)
    narrow = _example("bend")
    narrow["features"][1]["outline"]["width_mm"] = 40
    assert "joined edges differ in length (50 mm and 40 mm)" in _error(narrow)
    rounded = _example("bend")
    rounded["features"][1]["outline"]["corner_radius_mm"] = 2
    assert "bends need plain rectangle plates" in _error(rounded)
    missing = _example("bend")
    missing["features"][2]["from_plate"] = "nope"
    assert "must both be plates" in _error(missing)
    chain = _example("bend")
    chain["features"].append(copy.deepcopy(chain["features"][0]) | {"id": "third"})
    chain["features"].append(
        copy.deepcopy(chain["features"][2])
        | {"id": "bend_2", "from_plate": "leg", "to_plate": "third"}
    )
    assert "chains are not supported" in _error(chain)
