import copy
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

SPEC_DIR = Path(__file__).parent.parent / "src" / "geometry" / "spec"
SCHEMA = json.loads((SPEC_DIR / "part-spec.v1.schema.json").read_text())
V01_SCHEMA = json.loads((SPEC_DIR / "part-spec.schema.json").read_text())
VALIDATOR = Draft202012Validator(SCHEMA)
EXAMPLES = sorted((SPEC_DIR / "examples" / "v1").glob("*.json"))


def _example(name: str) -> dict[str, object]:
    return copy.deepcopy(json.loads((SPEC_DIR / "examples" / "v1" / f"{name}.json").read_text()))


def test_schema_is_valid() -> None:
    Draft202012Validator.check_schema(SCHEMA)


@pytest.mark.parametrize("path", EXAMPLES, ids=lambda p: p.stem)
def test_examples_are_valid(path: Path) -> None:
    VALIDATOR.validate(json.loads(path.read_text()))


def test_every_feature_type_has_an_example() -> None:
    declared = {ref["$ref"].rsplit("/", 1)[1] for ref in SCHEMA["$defs"]["feature"]["oneOf"]}
    used = {
        feature["type"] for path in EXAMPLES for feature in json.loads(path.read_text())["features"]
    }
    assert declared == used


def test_v01_specs_still_validate_against_v01_schema() -> None:
    v01 = Draft202012Validator(V01_SCHEMA)
    for path in (SPEC_DIR / "examples").glob("*.json"):
        v01.validate(json.loads(path.read_text()))


def test_v01_specs_are_not_v1_specs() -> None:
    # Versions are explicit: callers pick the schema from spec_version.
    spec = json.loads(next((SPEC_DIR / "examples").glob("*.json")).read_text())
    assert not VALIDATOR.is_valid(spec)


@pytest.mark.parametrize(
    ("example", "mutate"),
    [
        ("hole", lambda s: s.update(spec_version="0.1")),
        ("hole", lambda s: s["features"][1].update(diameter_mm=0)),
        ("hole", lambda s: s["features"][1].update(position_mm=[1, 2, 3])),
        ("plate-polygon", lambda s: s["features"][0]["outline"].update(points_mm=[[0, 0], [1, 1]])),
        (
            "plate-rounded-rectangle",
            lambda s: s["features"][0]["outline"].update(corner_radius_mm=-1),
        ),
        ("plate-polygon", lambda s: s["features"][0].pop("placement")),
        ("cutout", lambda s: s["features"][1].pop("placement")),
        ("countersink", lambda s: s["features"][1].update(sink_angle_deg=200)),
        ("bend", lambda s: s["features"][2].update(angle_deg=180)),
        ("bend", lambda s: s["features"][2].update(from_edge="top")),
        ("fillet", lambda s: s["features"][1].update(edges="diagonal")),
        ("emboss-text", lambda s: s["features"][1].update(text="")),
        ("rib", lambda s: s["features"][1].update(profile="round")),
        ("slot", lambda s: s["features"][1].update(surprise=True)),
    ],
    ids=[
        "old-version",
        "zero-diameter",
        "3d-hole-position",
        "two-point-polygon",
        "negative-corner-radius",
        "plate-without-placement",
        "cutout-without-placement",
        "huge-sink-angle",
        "flat-bend",
        "bad-bend-edge",
        "bad-edge-selector",
        "empty-text",
        "bad-rib-profile",
        "extra-field",
    ],
)
def test_invalid_specs_are_rejected(example: str, mutate: object) -> None:
    spec = _example(example)
    mutate(spec)  # type: ignore[operator]
    assert not VALIDATOR.is_valid(spec)
