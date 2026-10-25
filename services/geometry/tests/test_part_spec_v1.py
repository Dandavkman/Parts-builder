import copy
import json
from pathlib import Path
from typing import Any

import pytest
from jsonschema import Draft202012Validator

ROOT = Path(__file__).parent.parent
SPEC_DIR = ROOT / "src" / "geometry" / "spec"
DOC = ROOT.parent.parent / "docs" / "part-spec.md"
SCHEMA = json.loads((SPEC_DIR / "part-spec.schema.json").read_text())
VALIDATOR = Draft202012Validator(SCHEMA)
FEATURE_TYPES = [
    ref.rsplit("/", 1)[1] for ref in (o["$ref"] for o in SCHEMA["$defs"]["feature"]["oneOf"])
]
EXAMPLES: dict[str, dict[str, Any]] = {
    p.stem: json.loads(p.read_text()) for p in sorted((SPEC_DIR / "examples").glob("*.json"))
}


def _types(spec: dict[str, Any]) -> set[str]:
    return {f["type"] for f in spec["features"]}


def test_every_feature_type_has_an_example() -> None:
    used = set().union(*(_types(s) for s in EXAMPLES.values()))
    assert used == set(FEATURE_TYPES)


def test_every_feature_type_is_documented() -> None:
    text = DOC.read_text()
    for t in FEATURE_TYPES:
        assert f"### `{t}`" in text, f"docs/part-spec.md has no section for {t}"


def test_v01_specs_stay_valid() -> None:
    for name in ("plate-with-two-holes", "plate-with-hole-patterns"):
        assert EXAMPLES[name]["spec_version"] == "0.1"
        VALIDATOR.validate(EXAMPLES[name])


def test_v01_spec_cannot_use_v1_features() -> None:
    spec = copy.deepcopy(EXAMPLES["feature-counterbore"])
    spec["spec_version"] = "0.1"
    assert not VALIDATOR.is_valid(spec)
    spec = copy.deepcopy(EXAMPLES["plate-with-two-holes"])
    assert VALIDATOR.is_valid(spec)


def _feature(spec: dict[str, Any], type_: str) -> dict[str, Any]:
    return next(f for f in spec["features"] if f["type"] == type_)


NEW_TYPES = [t for t in FEATURE_TYPES if t not in ("plate", "hole", "hole_pattern")]
EXAMPLE_FOR = {
    t: next(n for n, s in EXAMPLES.items() if n.startswith("feature-") and t in _types(s))
    for t in NEW_TYPES
}


@pytest.mark.parametrize("type_", NEW_TYPES)
def test_new_feature_rejects_unknown_field(type_: str) -> None:
    spec = copy.deepcopy(EXAMPLES[EXAMPLE_FOR[type_]])
    _feature(spec, type_)["surprise"] = True
    assert not VALIDATOR.is_valid(spec)


@pytest.mark.parametrize("type_", NEW_TYPES)
def test_new_feature_requires_its_plate(type_: str) -> None:
    spec = copy.deepcopy(EXAMPLES[EXAMPLE_FOR[type_]])
    _feature(spec, type_).pop("plate")
    assert not VALIDATOR.is_valid(spec)


def _bad(name: str, type_: str, **changes: Any) -> dict[str, Any]:
    spec = copy.deepcopy(EXAMPLES[name])
    _feature(spec, type_).update(changes)
    return spec


@pytest.mark.parametrize(
    ("name", "type_", "changes"),
    [
        ("feature-counterbore", "counterbore", {"cbore_depth_mm": 0}),
        ("feature-counterbore", "counterbore", {"diameter_mm": -1}),
        ("feature-countersink", "countersink", {"csk_angle_deg": 30}),
        ("feature-countersink", "countersink", {"csk_angle_deg": 150}),
        ("feature-slot", "slot", {"width_mm": 0}),
        ("feature-slot", "slot", {"angle_deg": 400}),
        ("feature-standoff", "standoff", {"height_mm": -5}),
        ("feature-rib", "rib", {"profile": "round"}),
        ("feature-rib", "rib", {"from_mm": [1, 2, 3]}),
        ("feature-bend", "bend", {"edge": "up"}),
        ("feature-bend", "bend", {"angle_deg": 45}),
        ("feature-bend", "bend", {"inner_radius_mm": -1}),
        ("feature-fillet", "fillet", {"edges": "some"}),
        ("feature-fillet", "fillet", {"radius_mm": 0}),
        ("feature-chamfer", "chamfer", {"size_mm": 0}),
        ("feature-cutout", "cutout", {"shape": {"kind": "star"}}),
        ("feature-cutout", "cutout", {"shape": {"kind": "polygon", "points_mm": [[0, 0], [1, 1]]}}),
        (
            "feature-cutout",
            "cutout",
            {"shape": {"kind": "circle", "diameter_mm": 5, "width_mm": 2}},
        ),
        ("feature-text", "text", {"text": ""}),
        ("feature-text", "text", {"text": "x" * 41}),
        ("feature-text", "text", {"text": "café"}),
        ("feature-text", "text", {"depth_mm": 0}),
        ("feature-text", "text", {"mode": "paint"}),
    ],
)
def test_invalid_values_are_rejected(name: str, type_: str, changes: Any) -> None:
    assert not VALIDATOR.is_valid(_bad(name, type_, **changes))


def test_plate_needs_exactly_one_shape() -> None:
    both = copy.deepcopy(EXAMPLES["feature-plate-outline"])
    _feature(both, "plate").update(width_mm=10, length_mm=10)
    assert not VALIDATOR.is_valid(both)
    neither = copy.deepcopy(EXAMPLES["feature-plate-outline"])
    _feature(neither, "plate").pop("outline_mm")
    assert not VALIDATOR.is_valid(neither)
    two_points = copy.deepcopy(EXAMPLES["feature-plate-outline"])
    _feature(two_points, "plate")["outline_mm"] = [[0, 0], [1, 1]]
    assert not VALIDATOR.is_valid(two_points)
    half = copy.deepcopy(EXAMPLES["plate-with-two-holes"])
    _feature(half, "plate").pop("length_mm")
    assert not VALIDATOR.is_valid(half)


def test_hole_can_name_an_anchor_to_align_with() -> None:
    spec = copy.deepcopy(EXAMPLES["plate-with-two-holes"])
    spec["spec_version"] = "1.0"
    _feature(spec, "hole")["align_anchor"] = "mount_hole_left"
    VALIDATOR.validate(spec)
    _feature(spec, "hole")["align_anchor"] = ""
    assert not VALIDATOR.is_valid(spec)
