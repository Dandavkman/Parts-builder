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
]
ANCHORS = {"fender_bolt": Anchor((100.0, 50.0, 20.0), (0.0, 1.0, 0.0))}


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
def test_same_spec_gives_same_bytes(fmt: str) -> None:
    first = export_bytes(build_part(_example("hole-pattern")), fmt)
    second = export_bytes(build_part(_example("hole-pattern")), fmt)
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
    assert "not buildable yet" in _error(_example("rib"))
    assert "spec_version" in _error({"spec_version": "9.9", "name": "x", "features": []})


def test_slot_outside_plate() -> None:
    spec = _example("slot")
    spec["features"][1]["position_mm"] = [25, 0]
    assert "slot 'slot_1' is outside plate 'base'" in _error(spec)
