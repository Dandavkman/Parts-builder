"""Part Spec v1.1 adds a circle outline. v1.0 and v0.1 specs must keep building (rule 6)."""

import copy
import json
import math
import os
from pathlib import Path
from typing import Any

import pytest
from jsonschema import Draft202012Validator

from geometry.builder import SpecError, build_part
from geometry.builder.spec_io import validate_schema

SPEC_DIR = Path(__file__).parent.parent / "src" / "geometry" / "spec"
V1_1 = json.loads((SPEC_DIR / "part-spec.v1_1.schema.json").read_text())


def _circle() -> dict[str, Any]:
    return copy.deepcopy(
        json.loads((SPEC_DIR / "examples" / "v1_1" / "plate-circle.json").read_text())
    )


def test_v1_1_schema_is_valid() -> None:
    Draft202012Validator.check_schema(V1_1)


@pytest.mark.parametrize(
    "path", sorted((SPEC_DIR / "examples" / "v1").glob("*.json")), ids=lambda p: p.stem
)
def test_every_v1_example_is_valid_as_v1_1(path: Path) -> None:
    spec = json.loads(path.read_text())
    spec["spec_version"] = "1.1"
    Draft202012Validator(V1_1).validate(spec)


def test_circle_example_is_valid() -> None:
    validate_schema(_circle())


def test_v1_0_rejects_circle() -> None:
    spec = _circle()
    spec["spec_version"] = "1.0"
    with pytest.raises(SpecError):
        validate_schema(spec)


def test_circle_plate_geometry() -> None:
    part = build_part(_circle())
    bb = part.BoundingBox()
    assert (bb.xlen, bb.ylen, bb.zlen) == pytest.approx((50, 50, 5), abs=1e-6)
    expected = math.pi * (25**2 - 6**2) * 5
    assert part.Volume() == pytest.approx(expected, rel=1e-6)


def test_hole_outside_circle_is_reported() -> None:
    spec = _circle()
    spec["features"][1]["position_mm"] = [24, 0]  # 24 + 6 mm radius pokes out of a 25 mm radius
    with pytest.raises(SpecError):
        build_part(spec)


def test_hole_near_edge_of_circle_fits() -> None:
    spec = _circle()
    spec["features"][1].update(position_mm=[17, 0], diameter_mm=6)
    build_part(spec)


def test_top_edge_fillet_on_circle() -> None:
    spec = _circle()
    spec["features"].append(
        {"id": "round", "type": "fillet", "plate": "base", "edges": "top", "radius_mm": 1.5}
    )
    part = build_part(spec)
    assert part.Volume() < math.pi * (25**2 - 6**2) * 5


def test_vertical_fillet_on_circle_gives_a_plain_error_or_builds() -> None:
    spec = _circle()
    spec["features"].append(
        {"id": "round", "type": "fillet", "plate": "base", "edges": "vertical", "radius_mm": 2}
    )
    try:
        build_part(spec)
    except SpecError as error:
        assert "does not fit" in str(error)


def test_golden() -> None:
    bb = build_part(_circle()).BoundingBox()
    shape = build_part(_circle())
    summary = {
        "volume_mm3": round(shape.Volume(), 2),
        "bbox_mm": [round(v, 3) for v in (bb.xmin, bb.xmax, bb.ymin, bb.ymax, bb.zmin, bb.zmax)],
        "faces": len(shape.Faces()),
        "solids": len(shape.Solids()),
    }
    path = Path(__file__).parent / "golden" / "plate-circle.json"
    if os.environ.get("UPDATE_GOLDEN"):
        path.write_text(json.dumps(summary, indent=2) + "\n")
    expected = json.loads(path.read_text())
    assert summary["faces"] == expected["faces"]
    assert summary["solids"] == expected["solids"]
    assert summary["volume_mm3"] == pytest.approx(expected["volume_mm3"], abs=0.05)
    assert summary["bbox_mm"] == pytest.approx(expected["bbox_mm"], abs=0.001)
