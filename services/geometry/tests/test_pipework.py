"""Part Spec 3.1: reducers and flanges."""

import json
import math
from pathlib import Path
from typing import Any

import pytest
from jsonschema import Draft202012Validator

from geometry.builder import SpecError, build_part

SPEC_DIR = Path(__file__).parent.parent / "src" / "geometry" / "spec"
V3_1 = json.loads((SPEC_DIR / "part-spec.v3_1.schema.json").read_text())
EXAMPLES = sorted((SPEC_DIR / "examples" / "v3_1").glob("*.json"))
ORIGIN = {"anchor": "origin"}


def _spec(*features: dict[str, Any]) -> dict[str, Any]:
    return {"spec_version": "3.1", "name": "t", "features": list(features)}


def _reducer(**extra: Any) -> dict[str, Any]:
    return {
        "id": "red",
        "type": "reducer",
        "placement": ORIGIN,
        "start_mm": [0, 0, 0],
        "end_mm": [0, 0, 50],
        "start_diameter_mm": 40,
        "end_diameter_mm": 20,
        **extra,
    }


def _tube(**extra: Any) -> dict[str, Any]:
    return {
        "id": "pipe",
        "type": "tube",
        "placement": ORIGIN,
        "path_mm": [[0, 0, 0], [0, 0, 50]],
        "outer_diameter_mm": 20,
        "wall_thickness_mm": 2,
        **extra,
    }


def _flange(piece: str = "pipe", end: str = "start", **extra: Any) -> dict[str, Any]:
    return {
        "id": "fl",
        "type": "flange",
        "tube": piece,
        "end": end,
        "outline": {"kind": "circle", "diameter_mm": 60},
        "thickness_mm": 6,
        **extra,
    }


def _volume(spec: dict[str, Any]) -> float:
    part = build_part(spec)
    assert part.isValid()
    return float(part.Volume())


def test_schema_is_valid() -> None:
    Draft202012Validator.check_schema(V3_1)


@pytest.mark.parametrize("path", EXAMPLES, ids=lambda p: p.stem)
def test_examples_validate_and_build(path: Path) -> None:
    spec = json.loads(path.read_text())
    Draft202012Validator(V3_1).validate(spec)
    part = build_part(spec)
    assert part.isValid()
    assert len(part.Solids()) == 1


def test_every_3_0_example_is_a_valid_3_1_spec() -> None:
    for path in (SPEC_DIR / "examples" / "v3").glob("*.json"):
        spec = {**json.loads(path.read_text()), "spec_version": "3.1"}
        Draft202012Validator(V3_1).validate(spec)
        assert build_part(spec).isValid()


def test_solid_reducer_is_a_frustum() -> None:
    r1, r2, h = 20.0, 10.0, 50.0
    frustum = math.pi * h / 3 * (r1**2 + r1 * r2 + r2**2)
    assert _volume(_spec(_reducer())) == pytest.approx(frustum, rel=1e-4)


def test_hollow_reducer_removes_the_inner_cone() -> None:
    wall = 2.0
    outer = _volume(_spec(_reducer()))
    inner = math.pi * 50 / 3 * (18**2 + 18 * 8 + 8**2)
    assert _volume(_spec(_reducer(wall_thickness_mm=wall))) == pytest.approx(
        outer - inner, rel=1e-4
    )


def test_flange_adds_plate_and_keeps_the_bore_open() -> None:
    bare = _volume(_spec(_tube()))
    flanged = _volume(_spec(_tube(), _flange()))
    # The bore stays open: the flanged part has the pipe wall plus the plate ring, no inner disc.
    ring = math.pi * (30**2 - 8**2) * 6  # plate area outside the bore
    pipe_wall_in_plate = math.pi * (10**2 - 8**2) * 6
    assert flanged == pytest.approx(bare - pipe_wall_in_plate + ring, rel=1e-3)


def test_flange_sits_flush_with_the_pipe_end() -> None:
    box = build_part(_spec(_tube(), _flange(end="start"))).BoundingBox()
    assert (box.zmin, box.zmax) == pytest.approx((0, 50), abs=1e-3)
    assert box.xlen == pytest.approx(60, abs=1e-3)
    box_end = build_part(_spec(_tube(), _flange(end="end"))).BoundingBox()
    assert (box_end.zmin, box_end.zmax) == pytest.approx((0, 50), abs=1e-3)


def test_bolt_holes_are_cut_through_the_flange() -> None:
    holes = {
        "hole_diameter_mm": 6,
        "pattern": {"kind": "circular", "count": 4, "circle_diameter_mm": 44},
    }
    plain = _volume(_spec(_tube(), _flange()))
    drilled = _volume(_spec(_tube(), _flange(bolt_holes=holes)))
    assert plain - drilled == pytest.approx(4 * math.pi * 3**2 * 6, rel=1e-3)


def test_point_bolt_pattern_uses_the_flange_frame() -> None:
    """On a pipe along +Z, the flange X axis is world X, so a hole at [22, 0] is at x = 22."""
    holes = {"hole_diameter_mm": 6, "pattern": {"kind": "points", "points_mm": [[22, 0]]}}
    part = build_part(_spec(_tube(), _flange(bolt_holes=holes)))
    probe = build_part(_spec(_tube(), _flange()))
    assert probe.Volume() - part.Volume() == pytest.approx(math.pi * 3**2 * 6, rel=1e-3)
    # A point at x = 22 is empty in the drilled part and solid in the plain one.
    from cadquery import Vector

    assert not part.isInside(Vector(22, 0, 3))
    assert probe.isInside(Vector(22, 0, 3))


def test_flange_on_a_reducer_and_merge_with_flange() -> None:
    part = build_part(_spec(_reducer(wall_thickness_mm=2), _flange("red", "end")))
    assert part.isValid()
    assert part.BoundingBox().xlen == pytest.approx(60, abs=1e-3)


@pytest.mark.parametrize(
    ("features", "message"),
    [
        ([_tube(), _flange("nope")], "not a tube or reducer"),
        ([_tube(), _flange(), {**_flange(), "id": "fl2"}], "already has a flange"),
        ([_tube(wall_thickness_mm=None), _flange()], "wall_thickness_mm"),
        ([_tube(), _flange(outline={"kind": "circle", "diameter_mm": 20})], "wider than the pipe"),
        (
            [
                _tube(),
                _flange(
                    bolt_holes={
                        "hole_diameter_mm": 6,
                        "pattern": {"kind": "points", "points_mm": [[11, 0]]},
                    }
                ),
            ],
            "touches the pipe wall",
        ),
        (
            [
                _tube(),
                _flange(
                    bolt_holes={
                        "hole_diameter_mm": 6,
                        "pattern": {"kind": "points", "points_mm": [[29, 0]]},
                    }
                ),
            ],
            "runs off the flange",
        ),
        ([_reducer(start_mm=[0, 0, 0], end_mm=[0, 0, 0])], "same point"),
        ([_reducer(wall_thickness_mm=10)], "wall_thickness_mm"),
    ],
)
def test_bad_pipework_reports_plain_errors(features: list[dict[str, Any]], message: str) -> None:
    features = [{k: v for k, v in f.items() if v is not None} for f in features]
    spec = _spec(*features)
    Draft202012Validator(V3_1).validate(spec)
    with pytest.raises(SpecError) as err:
        build_part(spec)
    assert message in " ".join(err.value.errors)


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
