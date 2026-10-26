"""Load and normalize Part Specs. Specs of every released version stay buildable (rule 6)."""

import copy
import json
from functools import cache
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError, best_match

from geometry.builder.errors import SpecError

SPEC_DIR = Path(__file__).parent.parent / "spec"
SCHEMA_FILES = {
    "0.1": "part-spec.schema.json",
    "1.0": "part-spec.v1.schema.json",
    "1.1": "part-spec.v1_1.schema.json",
}

Spec = dict[str, Any]


@cache
def _validator(spec_version: str) -> Draft202012Validator:
    return Draft202012Validator(json.loads((SPEC_DIR / SCHEMA_FILES[spec_version]).read_text()))


def _root_cause(error: ValidationError) -> ValidationError:
    """Descend into a oneOf failure to the branch the spec was aiming for.

    A branch the spec was not aiming for fails on its `type` or `kind` tag.
    """
    while error.context:
        wrong = {
            e.relative_schema_path[0]
            for e in error.context
            if e.validator == "const" and list(e.relative_path)[-1:] in (["type"], ["kind"])
        }
        aimed = [e for e in error.context if e.relative_schema_path[0] not in wrong]
        error = best_match(aimed or error.context) or error
    return error


def validate_schema(spec: Spec) -> None:
    """Check the spec against the schema for its `spec_version`."""
    version = spec.get("spec_version")
    if version not in SCHEMA_FILES:
        raise SpecError(
            [f"spec_version {version!r} is not supported; use one of {list(SCHEMA_FILES)}"]
        )
    error = best_match(_validator(version).iter_errors(spec))
    error = _root_cause(error) if error else None
    if error is not None:
        raise SpecError(
            [f"{'/'.join(str(p) for p in error.absolute_path) or 'spec'}: {error.message}"]
        )


def to_v1(spec: Spec) -> Spec:
    """Return the spec in v1 shape. A v0.1 plate's width and length become a rectangle outline."""
    spec = copy.deepcopy(spec)
    if spec["spec_version"] == "0.1":
        for feature in spec["features"]:
            if feature["type"] == "plate":
                feature["outline"] = {
                    "kind": "rectangle",
                    "width_mm": feature.pop("width_mm"),
                    "length_mm": feature.pop("length_mm"),
                }
        spec["spec_version"] = "1.0"
    return spec
