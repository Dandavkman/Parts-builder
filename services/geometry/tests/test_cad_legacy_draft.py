"""Part Spec 4.3: draft, and CAD features that use plates, bodies, tubes and merges."""

import json
import math
import os
from pathlib import Path
from typing import Any

import pytest
from jsonschema import Draft202012Validator

from geometry.builder import SpecError, build_part
from geometry.toolbelt import call_tool

SPEC_DIR = Path(__file__).parent.parent / "src" / "geometry" / "spec"
V4_3 = json.loads((SPEC_DIR / "part-spec.v4_3.schema.json").read_text())
EXAMPLES = sorted((SPEC_DIR / "examples" / "v4_3").glob("*.json"))


def _spec(*features: dict[str, Any]) -> dict[str, Any]:
    return {"spec_version": "4.3", "name": "t", "features": list(features)}


def _block(sid: str = "blk", w: float = 40, h: float = 30, d: float = 20) -> list[dict[str, Any]]:
    return [
        {
            "id": f"{sid}_sk",
            "type": "sketch",
            "plane": {"name": "XY"},
            "shapes": [{"outer": {"kind": "rectangle", "width_mm": w, "height_mm": h}}],
        },
        {"id": sid, "type": "extrude", "sketch": f"{sid}_sk", "distance_mm": d},
    ]


def _body(bid: str = "box") -> dict[str, Any]:
    return {
        "id": bid,
        "type": "body",
        "placement": {"anchor": "origin"},
        "shape": {
            "kind": "extrude",
            "outline": {"kind": "rectangle", "width_mm": 40, "length_mm": 30},
            "height_mm": 20,
        },
    }


def _tube(tid: str, x: float) -> dict[str, Any]:
    return {
        "id": tid,
        "type": "tube",
        "placement": {"anchor": "origin"},
        "outer_diameter_mm": 10,
        "wall_thickness_mm": 2,
        "path_mm": [[x, 0, 0], [x, 0, 30]],
    }


def _errors(*features: dict[str, Any]) -> list[str]:
    with pytest.raises(SpecError) as info:
        build_part(_spec(*features))
    return list(info.value.errors)


def test_schema_is_valid() -> None:
    Draft202012Validator.check_schema(V4_3)


@pytest.mark.parametrize("path", EXAMPLES, ids=lambda p: p.stem)
def test_examples_validate_and_build(path: Path) -> None:
    spec = json.loads(path.read_text())
    Draft202012Validator(V4_3).validate(spec)
    assert build_part(spec).isValid()


def test_every_4_2_example_is_a_valid_4_3_spec() -> None:
    for path in (SPEC_DIR / "examples" / "v4_2").glob("*.json"):
        spec = {**json.loads(path.read_text()), "spec_version": "4.3"}
        Draft202012Validator(V4_3).validate(spec)
        assert build_part(spec).isValid()


def test_draft_matches_the_frustum_volume() -> None:
    part = build_part(
        _spec(
            *_block(),
            {"id": "d", "type": "draft", "solid": "blk", "angle_deg": 5, "faces": "sides"},
        )
    )
    shrink = 2 * 20 * math.tan(math.radians(5))
    a1, a2 = 40 * 30, (40 - shrink) * (30 - shrink)
    assert part.Volume() == pytest.approx(20 / 3 * (a1 + a2 + math.sqrt(a1 * a2)), rel=1e-4)
    bb = part.BoundingBox()
    assert (bb.xmax - bb.xmin) == pytest.approx(40, abs=1e-6)  # the bottom keeps its size


def test_draft_from_the_top_and_on_chosen_sides() -> None:
    part = build_part(
        _spec(
            *_block(),
            {
                "id": "d",
                "type": "draft",
                "solid": "blk",
                "angle_deg": 5,
                "neutral": "top",
                "faces": ["left", "right"],
            },
        )
    )
    plain = 40 * 30 * 20
    shed = 2 * 20 * math.tan(math.radians(5)) * 30 * 20 / 2
    assert part.Volume() == pytest.approx(
        plain - shed, rel=1e-3
    )  # left and right lean outward going down
    assert part.BoundingBox().ymax == pytest.approx(15, abs=1e-6)  # front and back untouched


def test_draft_on_a_cylinder_and_along_another_axis() -> None:
    cyl = {
        "id": "sk",
        "type": "sketch",
        "plane": {"name": "XY"},
        "shapes": [{"outer": {"kind": "circle", "diameter_mm": 30}}],
    }
    ex = {"id": "c", "type": "extrude", "sketch": "sk", "distance_mm": 20}
    drafted = build_part(
        _spec(cyl, ex, {"id": "d", "type": "draft", "solid": "c", "angle_deg": 3, "faces": "sides"})
    )
    assert drafted.Volume() < math.pi * 15**2 * 20
    sideways = build_part(
        _spec(
            *_block(),
            {
                "id": "d",
                "type": "draft",
                "solid": "blk",
                "angle_deg": 4,
                "pull_direction": "X",
                "faces": "sides",
            },
        )
    )
    assert sideways.isValid() and sideways.Volume() < 40 * 30 * 20


def test_draft_too_large_is_a_readable_error() -> None:
    errs = _errors(
        *_block(w=10, h=10, d=100),
        {"id": "d", "type": "draft", "solid": "blk", "angle_deg": 30, "faces": "sides"},
    )
    assert any("draft 'd' could not be built" in e for e in errs)


def test_draft_repeated_side_is_an_error() -> None:
    errs = _errors(
        *_block(),
        {"id": "d", "type": "draft", "solid": "blk", "angle_deg": 3, "faces": ["left", "left"]},
    )
    assert any("listed more than once" in e for e in errs)


def _cutter() -> list[dict[str, Any]]:
    return [
        {
            "id": "sk",
            "type": "sketch",
            "plane": {"name": "XY", "offset_mm": -1},
            "shapes": [{"outer": {"kind": "circle", "diameter_mm": 6}}],
        },
        {"id": "drill", "type": "extrude", "sketch": "sk", "distance_mm": 50},
    ]


def test_boolean_can_cut_a_body() -> None:
    part = build_part(
        _spec(
            _body(),
            *_cutter(),
            {
                "id": "out",
                "type": "boolean",
                "operation": "cut",
                "target": "box",
                "tools": ["drill"],
            },
        )
    )
    assert len(part.Solids()) == 1
    assert part.Volume() == pytest.approx(40 * 30 * 20 - math.pi * 9 * 20, rel=1e-4)


def test_an_unused_older_solid_stays_in_the_part() -> None:
    part = build_part(_spec(_body(), *_block("extra", w=10, h=10, d=5)))
    assert len(part.Solids()) == 2


def test_a_used_older_solid_is_not_counted_twice() -> None:
    part = build_part(
        _spec(
            _body(),
            {"id": "m", "type": "mirror", "source": "box", "plane": "YZ", "offset_mm": 20},
        )
    )
    assert len(part.Solids()) == 1
    assert part.Volume() == pytest.approx(2 * 40 * 30 * 20, rel=1e-6)


def test_fillet_and_hollow_work_on_a_body_and_a_plate() -> None:
    plain = build_part(_spec(_body())).Volume()
    rounded = build_part(
        _spec(
            _body(),
            {
                "id": "f",
                "type": "fillet_edges",
                "solid": "box",
                "edges": [{"parallel": "Z"}],
                "radius_mm": 3,
            },
        )
    )
    assert rounded.Volume() < plain
    plate = {
        "id": "pl",
        "type": "plate",
        "outline": {"kind": "rectangle", "width_mm": 40, "length_mm": 30},
        "thickness_mm": 5,
        "placement": {"anchor": "origin"},
    }
    chamfered = build_part(
        _spec(
            plate,
            {
                "id": "c",
                "type": "chamfer_edges",
                "solid": "pl",
                "edges": [{"on_face": "top"}],
                "distance_mm": 1,
            },
        )
    )
    assert chamfered.Volume() < 40 * 30 * 5


def test_a_tube_can_be_patterned_and_a_merged_tube_is_not_free_to_use() -> None:
    row = build_part(
        _spec(
            _tube("t", 0),
            {
                "id": "p",
                "type": "linear_pattern",
                "source": "t",
                "count": 3,
                "spacing_mm": [10, 0, 0],
            },
        )
    )
    # the copies only touch along a line, so they stay three solids
    assert row.isValid() and len(row.Solids()) == 3
    errs = _errors(
        _tube("a", 0),
        _tube("b", 5),
        {"id": "m", "type": "merge", "tubes": ["a", "b"]},
        {"id": "mir", "type": "mirror", "source": "a", "plane": "YZ"},
    )
    assert any("'a' is not a solid made by an earlier feature" in e for e in errs)


def test_older_solids_are_checked_like_cad_solids() -> None:
    errs = _errors(
        _body(),
        {"id": "m1", "type": "mirror", "source": "box", "plane": "YZ"},
        {"id": "m2", "type": "mirror", "source": "box", "plane": "XZ"},
    )
    assert any("already used up" in e for e in errs)


def test_draft_tool_and_older_solids_show_as_free_in_the_tool_belt() -> None:
    sketch = {
        "id": "sk",
        "plane": {"name": "XY"},
        "shapes": [{"outer": {"kind": "rectangle", "width_mm": 40, "height_mm": 30}}],
    }
    spec = call_tool("new_part", {"name": "p"})["spec"]
    spec = call_tool("add_sketch", {"spec": spec, **sketch})["spec"]
    spec = call_tool("extrude", {"spec": spec, "id": "blk", "sketch": "sk", "distance_mm": 20})[
        "spec"
    ]
    done = call_tool(
        "draft", {"spec": spec, "id": "d", "solid": "blk", "angle_deg": 3, "faces": "sides"}
    )
    assert done["ok"] and done["summary"]["free_solids"] == ["d"]
    assert done["spec"]["spec_version"] == "4.4"
    old = {"spec_version": "4.2", "name": "x", "features": [_body()]}
    assert call_tool("inspect_part", {"spec": old})["summary"]["free_solids"] == ["box"]


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
