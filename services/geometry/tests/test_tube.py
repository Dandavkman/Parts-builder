"""Part Spec 3.0: swept tubes and merges."""

import copy
import json
import math
from pathlib import Path
from typing import Any

import pytest
from jsonschema import Draft202012Validator

from geometry.builder import SpecError, build_part

SPEC_DIR = Path(__file__).parent.parent / "src" / "geometry" / "spec"
V3 = json.loads((SPEC_DIR / "part-spec.v3.schema.json").read_text())
EXAMPLES = sorted((SPEC_DIR / "examples" / "v3").glob("*.json"))


def _tube(path: list[list[float]], **extra: Any) -> dict[str, Any]:
    return {
        "id": "pipe",
        "type": "tube",
        "placement": {"anchor": "origin"},
        "path_mm": path,
        "outer_diameter_mm": 20,
        **extra,
    }


def _spec(*features: dict[str, Any]) -> dict[str, Any]:
    return {"spec_version": "3.0", "name": "t", "features": list(features)}


def test_schema_is_valid() -> None:
    Draft202012Validator.check_schema(V3)


@pytest.mark.parametrize("path", EXAMPLES, ids=lambda p: p.stem)
def test_examples_validate_and_build(path: Path) -> None:
    spec = json.loads(path.read_text())
    Draft202012Validator(V3).validate(spec)
    part = build_part(spec)
    assert part.isValid()
    assert len(part.Solids()) == 1


def test_every_v2_1_example_is_a_valid_3_0_spec() -> None:
    for path in (SPEC_DIR / "examples" / "v2_1").glob("*.json"):
        spec = {**json.loads(path.read_text()), "spec_version": "3.0"}
        Draft202012Validator(V3).validate(spec)
        assert build_part(spec).isValid()


def test_straight_solid_rod_volume() -> None:
    part = build_part(_spec(_tube([[0, 0, 0], [0, 0, 100]])))
    assert part.Volume() == pytest.approx(math.pi * 10**2 * 100, rel=1e-3)


def test_hollow_tube_volume_and_open_ends() -> None:
    part = build_part(_spec(_tube([[0, 0, 0], [0, 0, 100]], wall_thickness_mm=2)))
    assert part.Volume() == pytest.approx(math.pi * (10**2 - 8**2) * 100, rel=1e-3)


def test_bend_keeps_centerline_length() -> None:
    """A 90 degree bend of centerline radius R adds arc length pi*R/2 minus 2R of corner."""
    r = 30.0
    part = build_part(_spec(_tube([[0, 0, 0], [100, 0, 0], [100, 100, 0]], bend_radius_mm=r)))
    centerline = 100 + 100 - 2 * r + math.pi * r / 2
    assert part.Volume() == pytest.approx(math.pi * 10**2 * centerline, rel=2e-2)
    assert part.isValid()


def test_placement_moves_the_tube() -> None:
    spec = _spec(_tube([[0, 0, 0], [0, 0, 10]]))
    spec["features"][0]["placement"]["offset_mm"] = [5, 6, 7]
    box = build_part(spec).BoundingBox()
    assert (box.xmin, box.zmin, box.zmax) == pytest.approx((-5, 7, 17), abs=1e-3)


def test_merge_joins_passages() -> None:
    a = _tube([[0, 0, 0], [0, 0, 60]], id="a", wall_thickness_mm=2)
    b = _tube([[0, 0, 40], [0, 0, 100]], id="b", wall_thickness_mm=2)
    one = build_part(_spec(a, b, {"id": "m", "type": "merge", "tubes": ["a", "b"]}))
    assert len(one.Solids()) == 1
    two = build_part(_spec(a, b))
    assert len(two.Solids()) == 2
    # The merged bore is one clear passage: no wall remains where the tubes overlap.
    assert one.Volume() < two.Volume()


@pytest.mark.parametrize(
    ("feature", "message"),
    [
        (_tube([[0, 0, 0], [0, 0, 0]]), "same point"),
        (_tube([[0, 0, 0], [50, 0, 0], [0, 0, 0]]), "doubles back"),
        (_tube([[0, 0, 0], [50, 0, 0], [50, 50, 0]], bend_radius_mm=8), "larger than the tube"),
        (_tube([[0, 0, 0], [20, 0, 0], [20, 20, 0]], bend_radius_mm=30), "too short"),
        (_tube([[0, 0, 0], [0, 0, 50]], wall_thickness_mm=10), "wall_thickness_mm"),
    ],
)
def test_bad_tubes_report_plain_errors(feature: dict[str, Any], message: str) -> None:
    with pytest.raises(SpecError) as err:
        build_part(_spec(feature))
    assert message in " ".join(err.value.errors)


def test_merge_errors() -> None:
    a = _tube([[0, 0, 0], [0, 0, 10]], id="a")
    with pytest.raises(SpecError, match="not a tube"):
        build_part(_spec(a, {"id": "m", "type": "merge", "tubes": ["a", "nope"]}))
    far = _tube([[100, 0, 0], [100, 0, 10]], id="b")
    with pytest.raises(SpecError, match="do not overlap"):
        build_part(_spec(a, far, {"id": "m", "type": "merge", "tubes": ["a", "b"]}))
    c = _tube([[0, 0, 5], [0, 0, 15]], id="c")
    m1 = {"id": "m1", "type": "merge", "tubes": ["a", "c"]}
    m2 = {"id": "m2", "type": "merge", "tubes": ["a", "c"]}
    with pytest.raises(SpecError, match="already in another merge"):
        build_part(_spec(a, c, m1, m2))


def test_same_spec_gives_same_geometry() -> None:
    spec = json.loads(EXAMPLES[0].read_text())
    assert build_part(copy.deepcopy(spec)).Volume() == build_part(spec).Volume()


@pytest.mark.parametrize("path", EXAMPLES, ids=lambda p: p.stem)
def test_golden(path: Path) -> None:
    """Summaries live in tests/golden; regenerate with UPDATE_GOLDEN=1 and review the diff."""
    import os

    part = build_part(json.loads(path.read_text()))
    bb = part.BoundingBox()
    summary = {
        "volume_mm3": round(part.Volume(), 1),
        "bbox_mm": [round(v, 2) for v in (bb.xmin, bb.xmax, bb.ymin, bb.ymax, bb.zmin, bb.zmax)],
        "solids": len(part.Solids()),
    }
    golden = Path(__file__).parent / "golden" / f"{path.stem}.json"
    if os.environ.get("UPDATE_GOLDEN"):
        golden.write_text(json.dumps(summary, indent=2) + "\n")
    expected = json.loads(golden.read_text())
    assert summary["solids"] == expected["solids"]
    assert summary["volume_mm3"] == pytest.approx(expected["volume_mm3"], rel=1e-4)
    assert summary["bbox_mm"] == pytest.approx(expected["bbox_mm"], abs=0.01)
