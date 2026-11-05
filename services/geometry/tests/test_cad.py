"""Part Spec 4.0: sketches, extrude, revolve, boolean and transform."""

import json
import math
from pathlib import Path
from typing import Any

import pytest
from jsonschema import Draft202012Validator

from geometry.builder import SpecError, build_part

SPEC_DIR = Path(__file__).parent.parent / "src" / "geometry" / "spec"
V4 = json.loads((SPEC_DIR / "part-spec.v4.schema.json").read_text())
EXAMPLES = sorted((SPEC_DIR / "examples" / "v4").glob("*.json"))


def _spec(*features: dict[str, Any]) -> dict[str, Any]:
    return {"spec_version": "4.0", "name": "t", "features": list(features)}


def _rect(
    w: float = 20, h: float = 10, plane: str = "XY", sid: str = "sk", **loop: Any
) -> dict[str, Any]:
    return {
        "id": sid,
        "type": "sketch",
        "plane": {"name": plane},
        "shapes": [{"outer": {"kind": "rectangle", "width_mm": w, "height_mm": h, **loop}}],
    }


def _extrude(**extra: Any) -> dict[str, Any]:
    return {"id": "ex", "type": "extrude", "sketch": "sk", "distance_mm": 5, **extra}


def _build(*features: dict[str, Any]) -> Any:
    part = build_part(_spec(*features))
    assert part.isValid()
    return part


def test_schema_is_valid() -> None:
    Draft202012Validator.check_schema(V4)


@pytest.mark.parametrize("path", EXAMPLES, ids=lambda p: p.stem)
def test_examples_validate_and_build(path: Path) -> None:
    spec = json.loads(path.read_text())
    Draft202012Validator(V4).validate(spec)
    assert build_part(spec).isValid()


def test_every_3_2_example_is_a_valid_4_0_spec() -> None:
    for path in (SPEC_DIR / "examples" / "v3_2").glob("*.json"):
        spec = {**json.loads(path.read_text()), "spec_version": "4.0"}
        Draft202012Validator(V4).validate(spec)
        assert build_part(spec).isValid()


def test_rectangle_extrude_volume_and_frame() -> None:
    part = _build(_rect(), _extrude())
    assert part.Volume() == pytest.approx(20 * 10 * 5, rel=1e-6)
    box = part.BoundingBox()
    assert (box.zmin, box.zmax) == pytest.approx((0, 5), abs=1e-6)
    assert (box.xmin, box.xmax) == pytest.approx((-10, 10), abs=1e-6)


@pytest.mark.parametrize(("plane", "axis"), [("XY", "z"), ("XZ", "y"), ("YZ", "x")])
def test_plane_normals(plane: str, axis: str) -> None:
    box = _build(_rect(plane=plane), _extrude()).BoundingBox()
    lo, hi = getattr(box, f"{axis}min"), getattr(box, f"{axis}max")
    expected = (-5, 0) if plane == "XZ" else (0, 5)  # XZ's normal is -Y
    assert (lo, hi) == pytest.approx(expected, abs=1e-6)


def test_offset_and_origin_move_the_plane() -> None:
    sk = _rect()
    sk["plane"]["offset_mm"] = 7
    sk["plane"]["origin_mm"] = [3, 0, 0]
    box = _build(sk, _extrude()).BoundingBox()
    assert (box.zmin, box.zmax) == pytest.approx((7, 12), abs=1e-6)
    assert box.xmin == pytest.approx(-7, abs=1e-6)


def test_symmetric_and_reverse_directions() -> None:
    sym = _build(_rect(), _extrude(direction="symmetric")).BoundingBox()
    assert (sym.zmin, sym.zmax) == pytest.approx((-2.5, 2.5), abs=1e-6)
    rev = _build(_rect(), _extrude(direction="reverse")).BoundingBox()
    assert (rev.zmin, rev.zmax) == pytest.approx((-5, 0), abs=1e-6)


def test_taper_leans_the_sides_in() -> None:
    straight = _build(_rect(), _extrude()).Volume()
    leaning = _build(_rect(), _extrude(taper_deg=10)).Volume()
    assert leaning < straight


def test_taper_with_holes_is_refused_in_plain_words() -> None:
    sk = _rect()
    sk["shapes"][0]["holes"] = [{"kind": "circle", "diameter_mm": 3}]
    with pytest.raises(SpecError, match="taper_deg cannot be used on a sketch with holes"):
        build_part(_spec(sk, _extrude(taper_deg=5)))


def test_circle_with_hole_and_polygon() -> None:
    sk = {
        "id": "sk",
        "type": "sketch",
        "plane": {"name": "XY"},
        "shapes": [
            {
                "outer": {"kind": "circle", "diameter_mm": 40},
                "holes": [{"kind": "polygon", "points_mm": [[-5, -5], [5, -5], [5, 5], [-5, 5]]}],
            }
        ],
    }
    part = _build(sk, _extrude())
    assert part.Volume() == pytest.approx((math.pi * 20**2 - 100) * 5, rel=1e-6)


def test_ellipse_area() -> None:
    sk = _rect()
    sk["shapes"][0]["outer"] = {"kind": "ellipse", "major_mm": 40, "minor_mm": 20}
    assert _build(sk, _extrude()).Volume() == pytest.approx(math.pi * 20 * 10 * 5, rel=1e-6)


def test_path_with_line_arc_closes_itself() -> None:
    """A half disc: a diameter line plus a three-point arc closes back to the start."""
    sk = {
        "id": "sk",
        "type": "sketch",
        "plane": {"name": "XY"},
        "shapes": [
            {
                "outer": {
                    "kind": "path",
                    "start_mm": [-10, 0],
                    "segments": [{"kind": "arc", "mid_mm": [0, 10], "to_mm": [10, 0]}],
                }
            }
        ],
    }
    assert _build(sk, _extrude()).Volume() == pytest.approx(math.pi * 10**2 / 2 * 5, rel=1e-6)


def test_revolve_a_rectangle_makes_a_cylinder_and_a_partial_sweep() -> None:
    sk = {
        "id": "sk",
        "type": "sketch",
        "plane": {"name": "XZ"},
        "shapes": [
            {"outer": {"kind": "polygon", "points_mm": [[0, 0], [10, 0], [10, 20], [0, 20]]}}
        ],
    }
    full = _build(sk, {"id": "rv", "type": "revolve", "sketch": "sk"})
    assert full.Volume() == pytest.approx(math.pi * 10**2 * 20, rel=1e-6)
    half = _build(sk, {"id": "rv", "type": "revolve", "sketch": "sk", "angle_deg": 180})
    assert half.Volume() == pytest.approx(math.pi * 10**2 * 20 / 2, rel=1e-6)


def test_revolve_about_a_chosen_axis() -> None:
    """A 4 x 10 rectangle 6 mm from the axis spins into a ring."""
    sk = {
        "id": "sk",
        "type": "sketch",
        "plane": {"name": "XZ"},
        "shapes": [
            {"outer": {"kind": "polygon", "points_mm": [[6, 0], [10, 0], [10, 10], [6, 10]]}}
        ],
    }
    ring = _build(
        sk,
        {
            "id": "rv",
            "type": "revolve",
            "sketch": "sk",
            "axis": {"from_mm": [0, 0], "to_mm": [0, 5]},
        },
    )
    assert ring.Volume() == pytest.approx(math.pi * (10**2 - 6**2) * 10, rel=1e-6)


def test_cut_add_and_intersect_operations() -> None:
    base = [_rect(20, 20), _extrude(distance_mm=10)]
    cutter = _rect(10, 10, sid="sk2")
    cut = _build(
        *base,
        cutter,
        {
            "id": "c",
            "type": "extrude",
            "sketch": "sk2",
            "distance_mm": 20,
            "operation": "cut",
            "target": "ex",
        },
    )
    assert cut.Volume() == pytest.approx(20 * 20 * 10 - 10 * 10 * 10, rel=1e-6)
    add = _build(
        *base,
        cutter,
        {
            "id": "c",
            "type": "extrude",
            "sketch": "sk2",
            "distance_mm": 20,
            "operation": "add",
            "target": "ex",
        },
    )
    assert add.Volume() == pytest.approx(20 * 20 * 10 + 10 * 10 * 10, rel=1e-6)
    both = _build(
        *base,
        cutter,
        {
            "id": "c",
            "type": "extrude",
            "sketch": "sk2",
            "distance_mm": 20,
            "operation": "intersect",
            "target": "ex",
        },
    )
    assert both.Volume() == pytest.approx(10 * 10 * 10, rel=1e-6)


def test_boolean_union_cut_intersect_of_two_solids() -> None:
    parts = [
        _rect(20, 20),
        {**_extrude(), "distance_mm": 10},
        _rect(20, 20, sid="sk2"),
        {"id": "b", "type": "extrude", "sketch": "sk2", "distance_mm": 10},
        {"id": "mv", "type": "transform", "source": "b", "translate_mm": [10, 0, 0]},
    ]
    for op, expected in (("union", 6000), ("cut", 2000), ("intersect", 2000)):
        part = _build(
            *parts, {"id": "r", "type": "boolean", "operation": op, "target": "ex", "tools": ["mv"]}
        )
        assert part.Volume() == pytest.approx(expected, rel=1e-6), op


def test_transform_translate_rotate_mirror_and_copy() -> None:
    base = [_rect(20, 10), _extrude()]
    moved = _build(
        *base, {"id": "t", "type": "transform", "source": "ex", "translate_mm": [100, 0, 0]}
    )
    assert moved.BoundingBox().xmin == pytest.approx(90, abs=1e-6)
    turned = _build(
        *base,
        {
            "id": "t",
            "type": "transform",
            "source": "ex",
            "rotate": {"axis_point_mm": [0, 0, 0], "axis_dir": [0, 0, 1], "angle_deg": 90},
        },
    )
    assert turned.BoundingBox().xlen == pytest.approx(10, abs=1e-6)
    mirrored = _build(
        *base,
        {
            "id": "t",
            "type": "transform",
            "source": "ex",
            "mirror": {"plane": "YZ", "offset_mm": 50},
            "copy": True,
        },
    )
    assert len(mirrored.Solids()) == 2
    assert mirrored.BoundingBox().xmax == pytest.approx(110, abs=1e-6)


def test_unused_solids_all_stay_in_the_result() -> None:
    part = _build(
        _rect(),
        _extrude(),
        _rect(sid="sk2"),
        {"id": "ex2", "type": "extrude", "sketch": "sk2", "distance_mm": 3},
    )
    assert len(part.Solids()) == 2  # overlapping but separate: nothing combined them


@pytest.mark.parametrize(
    ("features", "message"),
    [
        ([_extrude()], "not a sketch made earlier"),
        ([_rect(), _extrude(operation="cut")], "needs a 'target'"),
        ([_rect(), _extrude(target="x")], "only used with add, cut or intersect"),
        ([_rect(), _extrude(operation="cut", target="nope")], "not a solid made by an earlier"),
        (
            [
                _rect(),
                _extrude(),
                {"id": "b", "type": "boolean", "operation": "cut", "target": "ex", "tools": ["ex"]},
            ],
            "already used up",
        ),
        (
            [_rect(), _extrude(), {"id": "t", "type": "transform", "source": "ex"}],
            "needs translate_mm",
        ),
        (
            [
                {
                    "id": "sk",
                    "type": "sketch",
                    "plane": {"name": "XY"},
                    "shapes": [
                        {"outer": {"kind": "polygon", "points_mm": [[0, 0], [1, 1], [2, 2]]}}
                    ],
                },
                _extrude(),
            ],
            "no area",
        ),
        (
            [
                {
                    "id": "sk",
                    "type": "sketch",
                    "plane": {"name": "XY"},
                    "shapes": [
                        {
                            "outer": {
                                "kind": "path",
                                "start_mm": [0, 0],
                                "segments": [{"kind": "arc", "mid_mm": [1, 1], "to_mm": [2, 2]}],
                            }
                        }
                    ],
                },
                _extrude(),
            ],
            "in a line",
        ),
        (
            [
                {
                    "id": "sk",
                    "type": "sketch",
                    "plane": {"name": "XY"},
                    "shapes": [{"outer": {"kind": "ellipse", "major_mm": 5, "minor_mm": 9}}],
                },
                _extrude(),
            ],
            "minor_mm",
        ),
    ],
)
def test_bad_cad_specs_report_plain_errors(features: list[dict[str, Any]], message: str) -> None:
    spec = _spec(*features)
    with pytest.raises(SpecError) as err:
        build_part(spec)
    assert message in " ".join(err.value.errors)


def test_cut_that_removes_everything_is_reported() -> None:
    cutter = _rect(40, 40, sid="sk2")
    with pytest.raises(SpecError, match="left no valid solid"):
        build_part(
            _spec(
                _rect(),
                _extrude(),
                cutter,
                {
                    "id": "c",
                    "type": "extrude",
                    "sketch": "sk2",
                    "distance_mm": 50,
                    "direction": "symmetric",
                    "operation": "cut",
                    "target": "ex",
                },
            )
        )


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
