"""CAD tool belt: small fixed operations on a Part Spec, for any agent or API.

Every tool takes the current spec, applies one change, checks the result and returns the updated
spec. Nothing is stored here (the service stays stateless): the caller keeps the spec between
calls, so it can undo by keeping the previous one. Tools are generated from the Part Spec schema,
so the schema stays the single description of what each operation accepts. No code from the caller
is ever run; a tool call only edits plain data that our own tested builder turns into geometry.
"""

import copy
import json
from functools import cache
from pathlib import Path
from typing import Any

from geometry.builder import SpecError, build_part
from geometry.builder.cad import CAD_TYPES, legacy_solid_ids
from geometry.builder.spec_io import SCHEMA_FILES, SPEC_DIR

Spec = dict[str, Any]
LATEST = "4.3"
UPGRADABLE = (
    "3.2",
    "4.0",
    "4.1",
    "4.2",
    "4.3",
)  # every spec of these versions is also valid as the latest

# Feature types exposed as tools, with the tool name an agent sees.
ADD_TOOLS: dict[str, str] = {
    "sketch": "add_sketch",
    "curve": "add_curve",
    "extrude": "extrude",
    "revolve": "revolve",
    "sweep": "sweep",
    "loft": "loft",
    "boolean": "boolean",
    "transform": "transform",
    "fillet_edges": "fillet_edges",
    "chamfer_edges": "chamfer_edges",
    "hollow": "hollow",
    "linear_pattern": "linear_pattern",
    "circular_pattern": "circular_pattern",
    "mirror": "mirror",
    "draft": "draft",
}
DEF_FOR_TYPE = {"extrude": "extrude_feature", "revolve": "revolve_feature"}
SPEC_ARG = {
    "type": "object",
    "description": "The current Part Spec, exactly as returned by the previous tool call.",
}


@cache
def _schema() -> Spec:
    return json.loads(Path(SPEC_DIR / SCHEMA_FILES[LATEST]).read_text())  # type: ignore[no-any-return]


def _refs(node: Any, found: set[str]) -> None:
    if isinstance(node, dict):
        ref = node.get("$ref")
        if isinstance(ref, str):
            found.add(ref.rsplit("/", 1)[-1])
        for value in node.values():
            _refs(value, found)
    elif isinstance(node, list):
        for value in node:
            _refs(value, found)


def _needed_defs(node: Any) -> Spec:
    """The schema definitions a tool's arguments point at, directly or through other definitions."""
    defs = _schema()["$defs"]
    found: set[str] = set()
    _refs(node, found)
    while True:
        before = len(found)
        for name in list(found):
            _refs(defs[name], found)
        if len(found) == before:
            return {n: defs[n] for n in sorted(found)}


def _tool_for(feature_type: str) -> Spec:
    feature_def = _schema()["$defs"][DEF_FOR_TYPE.get(feature_type, feature_type)]
    props = {k: v for k, v in feature_def["properties"].items() if k != "type"}
    required = ["spec", *(k for k in feature_def["required"] if k != "type")]
    return {
        "name": ADD_TOOLS[feature_type],
        "description": feature_def["description"],
        "inputSchema": {
            "type": "object",
            "properties": {"spec": SPEC_ARG, **props},
            "required": required,
            "additionalProperties": False,
            "$defs": _needed_defs(props),
        },
    }


@cache
def tool_definitions() -> list[Spec]:
    """All tools in MCP's tool format (name, description, inputSchema)."""
    tools: list[Spec] = [
        {
            "name": "new_part",
            "description": "Start an empty part. Returns the spec to pass to every other tool.",
            "inputSchema": {
                "type": "object",
                "properties": {"name": {"type": "string", "minLength": 1, "maxLength": 120}},
                "required": ["name"],
                "additionalProperties": False,
            },
        }
    ]
    tools += [_tool_for(t) for t in ADD_TOOLS]
    tools += [
        {
            "name": "remove_feature",
            "description": (
                "Delete the feature with this id. Later features that used it will report a "
                "problem, so remove those first or fix them."
            ),
            "inputSchema": {
                "type": "object",
                "properties": {"spec": SPEC_ARG, "id": {"$ref": "#/$defs/id"}},
                "required": ["spec", "id"],
                "$defs": {"id": _schema()["$defs"]["id"]},
                "additionalProperties": False,
            },
        },
        {
            "name": "inspect_part",
            "description": (
                "Check the spec and report its size: volume, bounding box, solid count, the "
                "feature list and which solids are still free to use. Changes nothing."
            ),
            "inputSchema": {
                "type": "object",
                "properties": {"spec": SPEC_ARG},
                "required": ["spec"],
                "additionalProperties": False,
            },
        },
    ]
    return tools


def _upgrade(spec: Spec) -> Spec:
    version = spec.get("spec_version")
    if version not in UPGRADABLE:
        raise SpecError(
            [f"the tool belt works on spec_version {LATEST}; start with new_part (got {version!r})"]
        )
    spec = copy.deepcopy(spec)
    spec["spec_version"] = LATEST
    return spec


def _open_solids(features: list[Spec]) -> list[str]:
    """Ids of CAD solids no later feature has used up (these become the part)."""
    made: list[str] = legacy_solid_ids(features)
    for f in features:
        t = f["type"]
        if t not in CAD_TYPES or t in ("sketch", "curve"):
            continue
        used: list[str] = []
        if t in ("extrude", "revolve", "sweep", "loft"):
            if f.get("operation", "new") != "new" and "target" in f:
                used = [f["target"]]
        elif t == "boolean":
            used = [f["target"], *f["tools"]]
        elif t == "transform":
            used = [] if f.get("copy") else [f["source"]]
        elif t in ("fillet_edges", "chamfer_edges", "hollow", "draft"):
            used = [f["solid"]]
        else:
            used = [f["source"]]
        made = [m for m in made if m not in used]
        made.append(f["id"])
    return made


def _summary(spec: Spec) -> Spec:
    part = build_part(spec)
    solids = part.Solids()
    out: Spec = {
        "features": [{"id": f["id"], "type": f["type"]} for f in spec["features"]],
        "free_solids": _open_solids(spec["features"]),
        "solid_count": len(solids),
    }
    if solids:
        bb = part.BoundingBox()
        out["volume_mm3"] = round(part.Volume(), 1)
        out["bbox_mm"] = {
            "x": [round(bb.xmin, 2), round(bb.xmax, 2)],
            "y": [round(bb.ymin, 2), round(bb.ymax, 2)],
            "z": [round(bb.zmin, 2), round(bb.zmax, 2)],
        }
    return out


def call_tool(name: str, arguments: Spec) -> Spec:
    """Run one tool. Returns {ok, spec, summary} or {ok: False, errors, spec} (spec unchanged).

    A rejected change never alters the spec: the caller can fix the arguments and call again.
    """
    args = dict(arguments)
    if name == "new_part":
        spec: Spec = {"spec_version": LATEST, "name": str(args.get("name", "")), "features": []}
        # an empty features list is not valid yet, so only the starting point is returned
        return {"ok": True, "spec": spec, "summary": {"features": [], "solid_count": 0}}
    try:
        current = _upgrade(args.pop("spec", {}))
    except SpecError as error:
        return {"ok": False, "errors": error.errors}
    try:
        if name == "inspect_part":
            return {"ok": True, "spec": current, "summary": _summary_checked(current)}
        if name == "remove_feature":
            kept = [f for f in current["features"] if f["id"] != args.get("id")]
            if len(kept) == len(current["features"]):
                raise SpecError([f"there is no feature '{args.get('id')}' to remove"])
            updated = {**current, "features": kept}
        else:
            feature_type = next((t for t, n in ADD_TOOLS.items() if n == name), None)
            if feature_type is None:
                raise SpecError([f"unknown tool '{name}'"])
            updated = {
                **current,
                "features": [*current["features"], {"type": feature_type, **args}],
            }
        return {"ok": True, "spec": updated, "summary": _summary_checked(updated)}
    except SpecError as error:
        return {"ok": False, "errors": error.errors, "spec": current}


def _summary_checked(spec: Spec) -> Spec:
    if not spec["features"]:
        return {"features": [], "solid_count": 0}
    return _summary(spec)
