"""Part Spec 4.2: hollow, linear_pattern, circular_pattern and mirror."""

import json
import os
from pathlib import Path
from typing import Any

import pytest
from jsonschema import Draft202012Validator

from geometry.builder import SpecError, build_part

SPEC_DIR = Path(__file__).parent.parent / "src" / "geometry" / "spec"
V4_2 = json.loads((SPEC_DIR / "part-spec.v4_2.schema.json").read_text())
EXAMPLES = sorted((SPEC_DIR / "examples" / "v4_2").glob("*.json"))


def _spec(*features: dict[str, Any]) -> dict[str, Any]:
    return {"spec_version": "4.2", "name": "t", "features": list(features)}


def _box(sid: str = "blk", w: float = 20, h: float = 10, d: float = 10) -> list[dict[str, Any]]:
    return [
        {
            "id": f"{sid}_sk",
            "type": "sketch",
            "plane": {"name": "XY"},
            "shapes": [{"outer": {"kind": "rectangle", "width_mm": w, "height_mm": h}}],
        },
        {"id": sid, "type": "extrude", "sketch": f"{sid}_sk", "distance_mm": d},
    ]


def _errors(*features: dict[str, Any]) -> list[str]:
    with pytest.raises(SpecError) as info:
        build_part(_spec(*features))
    return list(info.value.errors)


def test_schema_is_valid() -> None:
    Draft202012Validator.check_schema(V4_2)


@pytest.mark.parametrize("path", EXAMPLES, ids=lambda p: p.stem)
def test_examples_validate_and_build(path: Path) -> None:
    spec = json.loads(path.read_text())
    Draft202012Validator(V4_2).validate(spec)
    assert build_part(spec).isValid()


def test_every_4_1_example_is_a_valid_4_2_spec() -> None:
    for path in (SPEC_DIR / "examples" / "v4_1").glob("*.json"):
        spec = {**json.loads(path.read_text()), "spec_version": "4.2"}
        Draft202012Validator(V4_2).validate(spec)
        assert build_part(spec).isValid()


def test_closed_hollow_has_an_inner_cavity() -> None:
    part = build_part(
        _spec(*_box(), {"id": "h", "type": "hollow", "solid": "blk", "thickness_mm": 1})
    )
    assert part.Volume() == pytest.approx(2000 - 18 * 8 * 8, rel=1e-3)


def test_hollow_with_open_sides_is_a_cup() -> None:
    part = build_part(
        _spec(
            *_box(),
            {
                "id": "h",
                "type": "hollow",
                "solid": "blk",
                "thickness_mm": 1,
                "open_sides": ["top", "right"],
            },
        )
    )
    assert part.isValid() and len(part.Solids()) == 1
    assert part.Volume() < 2000 - 18 * 8 * 8


def test_hollow_wall_too_thick_is_a_readable_error() -> None:
    errs = _errors(*_box(), {"id": "h", "type": "hollow", "solid": "blk", "thickness_mm": 8})
    assert any("probably too thick" in e for e in errs)


def test_linear_pattern_of_touching_copies_is_one_solid() -> None:
    part = build_part(
        _spec(
            *_box(w=10),
            {
                "id": "row",
                "type": "linear_pattern",
                "source": "blk",
                "count": 4,
                "spacing_mm": [10, 0, 0],
            },
        )
    )
    assert len(part.Solids()) == 1
    assert part.Volume() == pytest.approx(4 * 1000, rel=1e-6)


def test_linear_pattern_of_cutters_makes_slots() -> None:
    cutter = _box("cut", w=2, h=10, d=12)  # the copy at x=20 is half outside the block
    part = build_part(
        _spec(
            *_box("blk", w=40, h=10, d=10),
            *cutter,
            {
                "id": "slots",
                "type": "linear_pattern",
                "source": "cut",
                "count": 3,
                "spacing_mm": [10, 0, 0],
            },
            {
                "id": "out",
                "type": "boolean",
                "operation": "cut",
                "target": "blk",
                "tools": ["slots"],
            },
        )
    )
    assert part.Volume() == pytest.approx(4000 - (2 + 2 + 1) * 10 * 10, rel=1e-6)


def test_circular_pattern_partial_angle_spreads_first_to_last() -> None:
    part = build_part(
        _spec(
            *_box("blk", w=2, h=2, d=2),
            {
                "id": "arc",
                "type": "circular_pattern",
                "source": "blk",
                "count": 3,
                "axis_point_mm": [-20, 0, 0],
                "axis_dir": [0, 0, 1],
                "angle_deg": 90,
            },
        )
    )
    assert len(part.Solids()) == 3
    bb = part.BoundingBox()
    assert bb.ymax > 15  # last copy swung a quarter turn about the axis 20 mm away


def test_pattern_axis_and_spacing_cannot_be_zero() -> None:
    errs = _errors(
        *_box(),
        {"id": "p", "type": "linear_pattern", "source": "blk", "count": 2, "spacing_mm": [0, 0, 0]},
    )
    assert any("spacing_mm cannot be" in e for e in errs)
    errs = _errors(
        *_box(),
        {
            "id": "p",
            "type": "circular_pattern",
            "source": "blk",
            "count": 2,
            "axis_point_mm": [0, 0, 0],
            "axis_dir": [0, 0, 0],
        },
    )
    assert any("axis_dir cannot be" in e for e in errs)


def test_mirror_across_an_offset_plane_joins_two_halves() -> None:
    part = build_part(
        _spec(
            *_box(w=10),
            {"id": "m", "type": "mirror", "source": "blk", "plane": "YZ", "offset_mm": 5},
        )
    )
    assert len(part.Solids()) == 1
    assert part.Volume() == pytest.approx(2000, rel=1e-6)
    assert part.BoundingBox().xmax == pytest.approx(15, abs=1e-6)


def test_source_solids_are_used_up_once() -> None:
    errs = _errors(
        *_box(),
        {"id": "m", "type": "mirror", "source": "blk", "plane": "YZ"},
        {"id": "h", "type": "hollow", "solid": "blk", "thickness_mm": 1},
    )
    assert any("already used up" in e for e in errs)


@pytest.mark.parametrize("path", EXAMPLES, ids=lambda p: p.stem)
def test_golden(path: Path) -> None:
    """Summaries live in tests/golden; regenerate with UPDATE_GOLDEN=1 and review the diff."""
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
