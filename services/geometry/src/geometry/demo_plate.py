"""Hard-coded demo part for the B0.3 skeleton: a 50 x 30 x 4 mm plate with two 6.5 mm holes.

B1.7 replaces this with a builder that reads a Part Spec.
"""

import tempfile
from pathlib import Path
from typing import cast

import cadquery as cq
import trimesh

PLATE_WIDTH_MM = 50.0
PLATE_LENGTH_MM = 30.0
PLATE_THICKNESS_MM = 4.0
HOLE_DIAMETER_MM = 6.5
HOLE_OFFSET_X_MM = 15.0

FORMATS = ("step", "stl", "glb")
MEDIA_TYPES = {
    "step": "model/step",
    "stl": "model/stl",
    "glb": "model/gltf-binary",
}


def build_demo_plate() -> cq.Workplane:
    return (
        cq.Workplane("XY")
        .box(PLATE_WIDTH_MM, PLATE_LENGTH_MM, PLATE_THICKNESS_MM)
        .faces(">Z")
        .workplane()
        .pushPoints([(-HOLE_OFFSET_X_MM, 0.0), (HOLE_OFFSET_X_MM, 0.0)])
        .hole(HOLE_DIAMETER_MM)
    )


def export_bytes(part: cq.Workplane, fmt: str) -> bytes:
    """Export a part as STEP, STL or GLB bytes."""
    if fmt not in FORMATS:
        raise ValueError(f"unknown format {fmt!r}; expected one of {FORMATS}")
    with tempfile.TemporaryDirectory() as tmp:
        step_or_stl = Path(tmp) / f"part.{'step' if fmt == 'step' else 'stl'}"
        cq.exporters.export(part, str(step_or_stl))
        if fmt != "glb":
            return step_or_stl.read_bytes()
        mesh = cast(trimesh.Trimesh, trimesh.load(str(step_or_stl), force="mesh"))
        data = mesh.export(file_type="glb")
        assert isinstance(data, bytes)
        return data
