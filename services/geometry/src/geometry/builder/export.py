"""Export a built part as STEP, STL or GLB, with the same bytes every time for the same part."""

import re
import tempfile
from pathlib import Path
from typing import cast

import cadquery as cq
import trimesh

FORMATS = ("step", "stl", "glb")
MEDIA_TYPES = {"step": "model/step", "stl": "model/stl", "glb": "model/gltf-binary"}
LINEAR_TOLERANCE_MM = 0.01
ANGULAR_TOLERANCE_RAD = 0.1
_STEP_TIMESTAMP = re.compile(rb"'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d'")
_STEP_PRODUCT_COUNTER = re.compile(rb"(Open CASCADE STEP translator [\d.]+) \d+")


def export_bytes(part: cq.Shape | cq.Workplane, fmt: str) -> bytes:
    if fmt not in FORMATS:
        raise ValueError(f"unknown format {fmt!r}; expected one of {FORMATS}")
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / f"part.{'step' if fmt == 'step' else 'stl'}"
        cq.exporters.export(
            part, str(path), tolerance=LINEAR_TOLERANCE_MM, angularTolerance=ANGULAR_TOLERANCE_RAD
        )
        data = path.read_bytes()
        if fmt == "step":
            # STEP carries the export time and a per-process export counter; pin both so
            # identical parts give identical files.
            data = _STEP_TIMESTAMP.sub(b"'1970-01-01T00:00:00'", data)
            return _STEP_PRODUCT_COUNTER.sub(rb"\1 1", data)
        if fmt == "stl":
            return data
        mesh = cast(trimesh.Trimesh, trimesh.load(str(path), force="mesh"))
        glb = mesh.export(file_type="glb")
        assert isinstance(glb, bytes)
        return glb
