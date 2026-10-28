"""Part Spec 2.1: blind bores and separate top and bottom round-overs on bodies."""

import copy
import json
import math
from pathlib import Path
from typing import Any

import pytest
from jsonschema import Draft202012Validator

from geometry.builder import SpecError, build_part
from geometry.builder.spec_io import validate_schema

SPEC_DIR = Path(__file__).parent.parent / "src" / "geometry" / "spec"
V2_1 = json.loads((SPEC_DIR / "part-spec.v2_1.schema.json").read_text())
EXAMPLES = sorted((SPEC_DIR / "examples" / "v2_1").glob("*.json"))


def _knob(**body: Any) -> dict[str, Any]:
    feature = {
        "id": "knob",
        "type": "body",
        "placement": {"anchor": "origin"},
        "shape": {
            "kind": "extrude",
            "outline": {"kind": "circle", "diameter_mm": 60},
            "height_mm": 35,
        },
    }
    feature.update(body)
    return {"spec_version": "2.1", "name": "knob", "features": [feature]}


def _volume(spec: dict[str, Any]) -> float:
    part = build_part(spec)
    assert part.isValid()
    assert len(part.Solids()) == 1
    return float(part.Volume())


def test_v2_1_schema_is_valid() -> None:
    Draft202012Validator.check_schema(V2_1)


@pytest.mark.parametrize("path", EXAMPLES, ids=lambda p: p.stem)
def test_every_v2_1_example_validates_and_builds(path: Path) -> None:
    spec = json.loads(path.read_text())
    validate_schema(spec)
    assert build_part(spec).isValid()


@pytest.mark.parametrize(
    "path", sorted((SPEC_DIR / "examples" / "v2").glob("*.json")), ids=lambda p: p.stem
)
def test_every_2_0_example_still_builds_and_is_valid_as_2_1(path: Path) -> None:
    spec = json.loads(path.read_text())
    validate_schema(spec)
    assert build_part(spec).isValid()
    spec["spec_version"] = "2.1"
    Draft202012Validator(V2_1).validate(spec)


def test_2_0_rejects_bores() -> None:
    spec = _knob(bores=[{"diameter_mm": 8.8, "depth_mm": 20, "from": "bottom"}])
    spec["spec_version"] = "2.0"
    with pytest.raises(SpecError):
        validate_schema(spec)


@pytest.mark.parametrize("side", ["bottom", "top"])
def test_blind_bore_volume_matches_hand_calculation(side: str) -> None:
    spec = _knob(bores=[{"diameter_mm": 8.8, "depth_mm": 20, "from": side}])
    expected = math.pi * 30**2 * 35 - math.pi * 4.4**2 * 20
    assert _volume(spec) == pytest.approx(expected, rel=1e-6)


def test_bore_stays_blind_at_the_far_end() -> None:
    part = build_part(_knob(bores=[{"diameter_mm": 8.8, "depth_mm": 20, "from": "bottom"}]))
    solid = part.Solids()[0]
    assert solid.isInside((0, 0, 10)) is False
    assert solid.isInside((0, 0, 25)) is True


def test_off_center_bore_position() -> None:
    spec = _knob(bores=[{"diameter_mm": 6, "depth_mm": 10, "from": "top", "position_mm": [10, 5]}])
    assert _volume(spec) == pytest.approx(math.pi * 30**2 * 35 - math.pi * 3**2 * 10, rel=1e-6)
    assert not build_part(spec).Solids()[0].isInside((10, 5, 30))


def test_top_only_round_over_removes_half_of_a_two_edge_round_over() -> None:
    plain = _volume(_knob())
    both = _volume(_knob(edge_fillet_mm=4))
    top = _volume(_knob(edge_fillet_top_mm=4))
    bottom = _volume(_knob(edge_fillet_bottom_mm=4))
    assert plain - top == pytest.approx((plain - both) / 2, rel=1e-6)
    assert plain - bottom == pytest.approx((plain - both) / 2, rel=1e-6)


def test_round_over_below_a_bore_still_builds() -> None:
    spec = _knob(
        edge_fillet_top_mm=4, bores=[{"diameter_mm": 8.8, "depth_mm": 35, "from": "bottom"}]
    )
    assert _volume(spec) > 0


def _errors(spec: dict[str, Any]) -> list[str]:
    with pytest.raises(SpecError) as info:
        build_part(spec)
    return list(info.value.errors)


def test_bore_deeper_than_the_body_is_rejected() -> None:
    text = " ".join(_errors(_knob(bores=[{"diameter_mm": 8, "depth_mm": 40, "from": "top"}])))
    assert "depth_mm" in text and "height_mm" in text


def test_bore_too_close_to_the_outside_is_rejected() -> None:
    text = " ".join(_errors(_knob(bores=[{"diameter_mm": 58, "depth_mm": 10, "from": "top"}])))
    assert "wall" in text


def test_bore_in_a_shelled_body_is_rejected() -> None:
    spec = _knob(
        shell={"wall_thickness_mm": 2, "open": "top"},
        bores=[{"diameter_mm": 8, "depth_mm": 10, "from": "bottom"}],
    )
    assert "shell" in " ".join(_errors(spec))


def test_edge_fillet_mm_cannot_be_mixed_with_the_separate_radii() -> None:
    text = " ".join(_errors(_knob(edge_fillet_mm=2, edge_fillet_top_mm=3)))
    assert "not both" in text


def test_round_over_of_half_the_height_or_more_is_rejected() -> None:
    spec = _knob(edge_fillet_top_mm=18)
    assert any("less than" in e for e in _errors(spec))


def test_spec_is_not_changed_by_building() -> None:
    spec = _knob(bores=[{"diameter_mm": 8.8, "depth_mm": 20, "from": "bottom"}])
    before = copy.deepcopy(spec)
    build_part(spec)
    assert spec == before
