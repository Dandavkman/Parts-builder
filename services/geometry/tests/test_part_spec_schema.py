import copy
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

SPEC_DIR = Path(__file__).parent.parent / "src" / "geometry" / "spec"
SCHEMA = json.loads((SPEC_DIR / "part-spec.schema.json").read_text())
VALIDATOR = Draft202012Validator(SCHEMA)
EXAMPLES = sorted((SPEC_DIR / "examples").glob("*.json"))


def test_schema_is_valid() -> None:
    Draft202012Validator.check_schema(SCHEMA)


@pytest.mark.parametrize("path", EXAMPLES, ids=lambda p: p.stem)
def test_examples_are_valid(path: Path) -> None:
    VALIDATOR.validate(json.loads(path.read_text()))


def _base() -> dict[str, object]:
    return copy.deepcopy(json.loads(EXAMPLES[-1].read_text()))


@pytest.mark.parametrize(
    "mutate",
    [
        lambda s: s.update(spec_version="9.9"),
        lambda s: s["features"][0].update(thickness_mm=-1),
        lambda s: s["features"][0].update(thickness_mm=0),
        lambda s: s["features"][0].update(type="sphere"),
        lambda s: s["features"][0].pop("placement"),
        lambda s: s["features"][0].update(surprise=True),
        lambda s: s["features"][1].update(position_mm=[1, 2, 3]),
        lambda s: s.update(features=[]),
        lambda s: s["features"][0].update(id="Bad Id"),
    ],
    ids=[
        "wrong-version",
        "negative-thickness",
        "zero-thickness",
        "unknown-type",
        "missing-placement",
        "extra-field",
        "3d-hole-position",
        "no-features",
        "bad-id",
    ],
)
def test_invalid_specs_are_rejected(mutate: object) -> None:
    spec = _base()
    mutate(spec)  # type: ignore[operator]
    assert not VALIDATOR.is_valid(spec)
