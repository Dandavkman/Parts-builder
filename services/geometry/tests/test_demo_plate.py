import io
import tempfile
from pathlib import Path
from typing import cast

import cadquery as cq
import pytest
import trimesh
from fastapi.testclient import TestClient

from geometry.api import app
from geometry.demo_plate import (
    HOLE_DIAMETER_MM,
    PLATE_LENGTH_MM,
    PLATE_THICKNESS_MM,
    PLATE_WIDTH_MM,
    build_demo_plate,
    export_bytes,
)

client = TestClient(app)


def _load_step(data: bytes) -> cq.Shape:
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "part.step"
        path.write_bytes(data)
        shape = cq.importers.importStep(str(path)).val()
        assert isinstance(shape, cq.Shape)
        return shape


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_step_hole_diameters_within_0_01_mm() -> None:
    shape = _load_step(client.post("/build?format=step").content)
    cylinders = cq.Workplane(obj=shape).faces("%CYLINDER").vals()
    assert len(cylinders) == 2
    circles = cq.Workplane(obj=shape).edges("%CIRCLE").vals()
    assert len(circles) == 4  # top and bottom edge of each hole
    for edge in circles:
        assert isinstance(edge, cq.Edge)
        assert edge.radius() * 2 == pytest.approx(HOLE_DIAMETER_MM, abs=0.01)


def test_step_bounding_box_matches_plate() -> None:
    box = _load_step(client.post("/build?format=step").content).BoundingBox()
    assert box.xlen == pytest.approx(PLATE_WIDTH_MM, abs=0.01)
    assert box.ylen == pytest.approx(PLATE_LENGTH_MM, abs=0.01)
    assert box.zlen == pytest.approx(PLATE_THICKNESS_MM, abs=0.01)


@pytest.mark.parametrize("fmt", ["stl", "glb"])
def test_mesh_formats_load_and_are_watertight(fmt: str) -> None:
    response = client.post(f"/build?format={fmt}")
    assert response.status_code == 200
    mesh = cast(
        trimesh.Trimesh,
        trimesh.load(file_obj=io.BytesIO(response.content), file_type=fmt, force="mesh"),
    )
    assert mesh.is_watertight
    assert mesh.volume == pytest.approx(
        PLATE_WIDTH_MM * PLATE_LENGTH_MM * PLATE_THICKNESS_MM
        - 2 * 3.141592653589793 * (HOLE_DIAMETER_MM / 2) ** 2 * PLATE_THICKNESS_MM,
        rel=0.01,
    )


def test_same_input_gives_same_step_geometry() -> None:
    a = _load_step(export_bytes(build_demo_plate(), "step"))
    b = _load_step(export_bytes(build_demo_plate(), "step"))
    assert a.Volume() == pytest.approx(b.Volume(), abs=1e-9)


def test_unknown_format_is_rejected() -> None:
    assert client.post("/build?format=obj").status_code == 422
    with pytest.raises(ValueError):
        export_bytes(build_demo_plate(), "obj")
