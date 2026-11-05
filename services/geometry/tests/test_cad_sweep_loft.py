"""Part Spec 4.1: curves, sweep, loft, fillet_edges and chamfer_edges."""

import json
import os
from pathlib import Path
from typing import Any

import pytest
from jsonschema import Draft202012Validator

from geometry.builder import SpecError, build_part

SPEC_DIR = Path(__file__).parent.parent / "src" / "geometry" / "spec"
V4_1 = json.loads((SPEC_DIR / "part-spec.v4_1.schema.json").read_text())
EXAMPLES = sorted((SPEC_DIR / "examples" / "v4_1").glob("*.json"))


def _spec(*features: dict[str, Any]) -> dict[str, Any]:
    return {"spec_version": "4.1", "name": "t", "features": list(features)}


def _circle(sid: str, d: float = 10, plane: str = "XY", offset: float = 0) -> dict[str, Any]:
    return {
        "id": sid,
        "type": "sketch",
        "plane": {"name": plane, "offset_mm": offset},
        "shapes": [{"outer": {"kind": "circle", "diameter_mm": d}}],
    }


def _line_curve(cid: str = "route", length: float = 50) -> dict[str, Any]:
    return {
        "id": cid,
        "type": "curve",
        "plane": {"name": "XZ"},
        "start_mm": [0, 0],
        "segments": [{"kind": "line", "to_mm": [0, length]}],
    }


def _block() -> list[dict[str, Any]]:
    return [
        {
            "id": "sk",
            "type": "sketch",
            "plane": {"name": "XY"},
            "shapes": [{"outer": {"kind": "rectangle", "width_mm": 40, "height_mm": 20}}],
        },
        {"id": "blk", "type": "extrude", "sketch": "sk", "distance_mm": 10},
    ]


def _errors(*features: dict[str, Any]) -> list[str]:
    with pytest.raises(SpecError) as info:
        build_part(_spec(*features))
    return list(info.value.errors)


def test_schema_is_valid() -> None:
    Draft202012Validator.check_schema(V4_1)


@pytest.mark.parametrize("path", EXAMPLES, ids=lambda p: p.stem)
def test_examples_validate_and_build(path: Path) -> None:
    spec = json.loads(path.read_text())
    Draft202012Validator(V4_1).validate(spec)
    assert build_part(spec).isValid()


def test_every_4_0_example_is_a_valid_4_1_spec() -> None:
    for path in (SPEC_DIR / "examples" / "v4").glob("*.json"):
        spec = {**json.loads(path.read_text()), "spec_version": "4.1"}
        Draft202012Validator(V4_1).validate(spec)
        assert build_part(spec).isValid()


def test_straight_sweep_matches_extrude_volume() -> None:
    part = build_part(_spec(_circle("prof", 10), _line_curve(length=50), _sweep()))
    assert part.Volume() == pytest.approx(3.14159265 * 25 * 50, rel=1e-3)


def _sweep(**extra: Any) -> dict[str, Any]:
    return {"id": "sw", "type": "sweep", "profile": "prof", "path": "route", **extra}


def test_sweep_cut_hollows_a_block() -> None:
    plain = build_part(_spec(*_block())).Volume()
    cut = build_part(
        _spec(
            *_block(),
            _circle("prof", 6, "XY", -1),
            {
                "id": "route",
                "type": "curve",
                "plane": {"name": "XZ"},
                "start_mm": [0, -1],
                "segments": [{"kind": "line", "to_mm": [0, 11]}],
            },
            _sweep(operation="cut", target="blk"),
        )
    )
    assert cut.Volume() == pytest.approx(plain - 3.14159265 * 9 * 10, rel=1e-3)


def test_sweep_profile_must_touch_curve_start() -> None:
    errs = _errors(_circle("prof", 10, "XY", 20), _line_curve(), _sweep())
    assert any("pass through the start of the curve" in e for e in errs)


def test_sweep_unknown_references_are_named() -> None:
    errs = _errors(_circle("prof"), _sweep())
    assert any("'route' is not a curve" in e for e in errs)
    errs = _errors(_line_curve(), _sweep())
    assert any("'prof' is not a sketch" in e for e in errs)


def test_curve_arc_in_a_line_is_rejected() -> None:
    bad = _line_curve()
    bad["segments"] = [{"kind": "arc", "mid_mm": [0, 5], "to_mm": [0, 10]}]
    errs = _errors(_circle("prof"), bad, _sweep())
    assert any("three points are in a line" in e for e in errs)


def test_loft_between_two_circles_is_a_cone_frustum() -> None:
    part = build_part(
        _spec(
            _circle("a", 20),
            _circle("b", 10, "XY", 30),
            {"id": "cone", "type": "loft", "sketches": ["a", "b"]},
        )
    )
    expected = 3.14159265 * 30 / 3 * (10**2 + 10 * 5 + 5**2)
    assert part.Volume() == pytest.approx(expected, rel=2e-3)


def test_loft_rejects_holes_and_repeats() -> None:
    holed = _circle("a", 20)
    holed["shapes"][0]["holes"] = [{"kind": "circle", "diameter_mm": 5}]
    errs = _errors(
        holed, _circle("b", 10, "XY", 30), {"id": "l", "type": "loft", "sketches": ["a", "b"]}
    )
    assert any("one outline without holes" in e for e in errs)
    errs = _errors(_circle("a"), {"id": "l", "type": "loft", "sketches": ["a", "a"]})
    assert any("more than once" in e for e in errs)


def test_fillet_all_edges_removes_volume_and_keeps_one_solid() -> None:
    plain = build_part(_spec(*_block())).Volume()
    part = build_part(
        _spec(
            *_block(),
            {"id": "f", "type": "fillet_edges", "solid": "blk", "edges": "all", "radius_mm": 2},
        )
    )
    assert part.isValid() and len(part.Solids()) == 1
    assert part.Volume() < plain


def test_chamfer_on_top_face_only() -> None:
    plain = build_part(_spec(*_block())).Volume()
    part = build_part(
        _spec(
            *_block(),
            {
                "id": "c",
                "type": "chamfer_edges",
                "solid": "blk",
                "edges": [{"on_face": "top"}],
                "distance_mm": 1,
            },
        )
    )
    # 4 top edges, 1 mm bevel: removes 1/2 * 1 * 1 * perimeter (120) minus corner overlap, about 60
    assert plain - part.Volume() == pytest.approx(60, abs=3)
    assert part.BoundingBox().zmax == pytest.approx(10, abs=1e-6)


def test_edge_choices_combine_and_near_point_works() -> None:
    plain = build_part(_spec(*_block())).Volume()
    one_corner = build_part(
        _spec(
            *_block(),
            {
                "id": "f",
                "type": "fillet_edges",
                "solid": "blk",
                "edges": [{"near_mm": [20, 10, 5], "within_mm": 1}],
                "radius_mm": 3,
            },
        )
    )
    assert plain - one_corner.Volume() == pytest.approx((1 - 3.14159265 / 4) * 9 * 10, rel=2e-2)


def test_edge_choice_that_matches_nothing_is_an_error() -> None:
    errs = _errors(
        *_block(),
        {
            "id": "f",
            "type": "fillet_edges",
            "solid": "blk",
            "edges": [{"near_mm": [500, 500, 500], "within_mm": 1}],
            "radius_mm": 1,
        },
    )
    assert any("matched no edges" in e for e in errs)


def test_oversized_fillet_gives_a_readable_error() -> None:
    errs = _errors(
        *_block(),
        {"id": "f", "type": "fillet_edges", "solid": "blk", "edges": "all", "radius_mm": 50},
    )
    assert any("probably too large" in e for e in errs)


def test_finished_solid_cannot_be_reused() -> None:
    errs = _errors(
        *_block(),
        {"id": "f", "type": "fillet_edges", "solid": "blk", "edges": "all", "radius_mm": 1},
        {"id": "g", "type": "chamfer_edges", "solid": "blk", "edges": "all", "distance_mm": 1},
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
