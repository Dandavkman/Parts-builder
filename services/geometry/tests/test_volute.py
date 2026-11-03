"""Part Spec 3.2: the turbine volute."""

import json
import math
from pathlib import Path
from typing import Any

import pytest
from cadquery import Vector
from jsonschema import Draft202012Validator

from geometry.builder import SpecError, build_part
from geometry.builder.volute import VoluteSize

SPEC_DIR = Path(__file__).parent.parent / "src" / "geometry" / "spec"
V3_2 = json.loads((SPEC_DIR / "part-spec.v3_2.schema.json").read_text())
EXAMPLES = sorted((SPEC_DIR / "examples" / "v3_2").glob("*.json"))


def _volute(**extra: Any) -> dict[str, Any]:
    return {
        "id": "housing",
        "type": "volute",
        "placement": {"anchor": "origin"},
        "inducer_diameter_mm": 53.8,
        "exducer_diameter_mm": 47,
        "a_over_r_cm": 0.64,
        "wall_thickness_mm": 3,
        "inlet_length_mm": 30,
        "outlet_length_mm": 70,
        **extra,
    }


def _spec(*features: dict[str, Any]) -> dict[str, Any]:
    return {"spec_version": "3.2", "name": "t", "features": list(features)}


def test_schema_is_valid() -> None:
    Draft202012Validator.check_schema(V3_2)


@pytest.mark.parametrize("path", EXAMPLES, ids=lambda p: p.stem)
def test_examples_validate_and_build(path: Path) -> None:
    spec = json.loads(path.read_text())
    Draft202012Validator(V3_2).validate(spec)
    part = build_part(spec)
    assert part.isValid()
    assert len(part.Solids()) == 1


def test_every_3_1_example_is_a_valid_3_2_spec() -> None:
    for path in (SPEC_DIR / "examples" / "v3_1").glob("*.json"):
        spec = {**json.loads(path.read_text()), "spec_version": "3.2"}
        Draft202012Validator(V3_2).validate(spec)
        assert build_part(spec).isValid()


@pytest.mark.parametrize("a_over_r", [0.36, 0.64, 1.06])
def test_largest_section_matches_the_requested_a_over_r(a_over_r: float) -> None:
    """Area over centroid radius of the largest section equals the A/R asked for."""
    size = VoluteSize(_volute(a_over_r_cm=a_over_r))
    area_mm2 = math.pi * size.rho_max**2
    assert area_mm2 / size.rc_max == pytest.approx(a_over_r * 10, rel=1e-9)


def test_bigger_a_over_r_gives_a_bigger_housing() -> None:
    small = build_part(_spec(_volute(a_over_r_cm=0.5)))
    large = build_part(_spec(_volute(a_over_r_cm=1.0)))
    assert large.BoundingBox().xlen > small.BoundingBox().xlen


def test_passages_are_open_and_walls_are_solid() -> None:
    spec = _spec(_volute())
    part = build_part(spec)
    size = VoluteSize(spec["features"][0])
    # Inside the inlet stub: empty. In its wall: solid.
    assert not part.isInside(Vector(size.rc_max, -20, 0))
    assert part.isInside(Vector(size.rc_max + size.rho_max + 1.5, -20, 0))
    # On the exhaust axis: empty. In the cone wall below the scroll: solid.
    assert not part.isInside(Vector(0, 0, -50))
    assert part.isInside(Vector(size.exducer_r + 1.5, 0, -69))
    # Mid-scroll passage (180 degrees, on -X): empty.
    rho = size.rho(180)
    assert not part.isInside(Vector(-(size.cavity_r + rho), 0, 0))


def test_bbox_follows_the_geometry() -> None:
    spec = _spec(_volute())
    size = VoluteSize(spec["features"][0])
    box = build_part(spec).BoundingBox()
    assert box.zmin == pytest.approx(-70, abs=1e-3)
    assert box.zmax == pytest.approx(size.rho_max + size.wall, abs=0.05)
    assert box.xmax == pytest.approx(size.rc_max + size.rho_max + size.wall, abs=0.05)
    assert box.ymin <= -30  # the inlet stub reaches out on -Y


def test_runner_merges_into_the_inlet() -> None:
    size = VoluteSize(_volute())
    runner = {
        "id": "runner",
        "type": "tube",
        "placement": {"anchor": "origin"},
        "path_mm": [[size.rc_max, -90, 0], [size.rc_max, -20, 0]],
        "outer_diameter_mm": size.inlet_outer_diameter,
        "wall_thickness_mm": 3,
    }
    merge = {"id": "m", "type": "merge", "tubes": ["housing", "runner"]}
    part = build_part(_spec(_volute(), runner, merge))
    assert part.isValid()
    assert len(part.Solids()) == 1
    assert not part.isInside(Vector(size.rc_max, -60, 0))


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"outlet_length_mm": 12}, "outlet_length_mm must be at least"),
        ({"exducer_diameter_mm": 80}, "smaller than the wheel cavity"),
        ({"wall_thickness_mm": 0.5}, "wall_thickness_mm must be at least"),
    ],
)
def test_bad_volutes_report_plain_errors(overrides: dict[str, Any], message: str) -> None:
    with pytest.raises(SpecError) as err:
        build_part(_spec(_volute(**overrides)))
    assert message in " ".join(err.value.errors)


def test_flange_ends_are_checked_per_piece() -> None:
    flange = {
        "id": "fl",
        "type": "flange",
        "tube": "housing",
        "end": "start",
        "outline": {"kind": "circle", "diameter_mm": 90},
        "thickness_mm": 6,
    }
    with pytest.raises(SpecError, match="inlet and outlet"):
        build_part(_spec(_volute(), flange))


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
    assert summary["volume_mm3"] == pytest.approx(expected["volume_mm3"], rel=1e-3)
    assert summary["bbox_mm"] == pytest.approx(expected["bbox_mm"], abs=0.05)
