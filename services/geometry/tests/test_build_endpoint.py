import io
import tempfile
from pathlib import Path
from typing import Any, cast

import cadquery as cq
import pytest
import trimesh
from fastapi.testclient import TestClient

from geometry.api import app

client = TestClient(app)
EXAMPLES = Path(__file__).parent.parent / "src" / "geometry" / "spec" / "examples"


def _spec() -> dict[str, Any]:
    return {
        "spec_version": "1.0",
        "name": "Test Bracket #1",
        "features": [
            {
                "id": "base",
                "type": "plate",
                "outline": {"kind": "rectangle", "width_mm": 60, "length_mm": 40},
                "thickness_mm": 4,
                "placement": {"anchor": "origin"},
            },
            {
                "id": "h1",
                "type": "hole",
                "plate": "base",
                "diameter_mm": 6.5,
                "position_mm": [10, 5],
            },
        ],
    }


def _step_shape(data: bytes) -> cq.Shape:
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "part.step"
        path.write_bytes(data)
        shape = cq.importers.importStep(str(path)).val()
        assert isinstance(shape, cq.Shape)
        return shape


def test_downloaded_step_has_the_right_dimensions() -> None:
    response = client.post("/build?format=step", json={"spec": _spec()})
    assert response.status_code == 200
    assert response.headers["content-type"] == "model/step"
    shape = _step_shape(response.content)
    box = shape.BoundingBox()
    assert (box.xlen, box.ylen, box.zlen) == pytest.approx((60, 40, 4), abs=0.01)
    circles = [e for e in cq.Workplane(obj=shape).edges("%CIRCLE").vals() if isinstance(e, cq.Edge)]
    assert len(circles) == 2
    assert all(e.radius() * 2 == pytest.approx(6.5, abs=0.01) for e in circles)
    assert all(e.Center().x == pytest.approx(10, abs=0.01) for e in circles)
    assert all(e.Center().y == pytest.approx(5, abs=0.01) for e in circles)


@pytest.mark.parametrize("fmt", ["stl", "glb"])
def test_mesh_downloads_are_watertight_and_the_right_size(fmt: str) -> None:
    response = client.post(f"/build?format={fmt}", json={"spec": _spec()})
    assert response.status_code == 200
    mesh = cast(
        trimesh.Trimesh, trimesh.load(io.BytesIO(response.content), file_type=fmt, force="mesh")
    )
    assert mesh.is_watertight
    assert mesh.extents == pytest.approx((60, 40, 4), abs=0.01)


def test_download_has_a_safe_filename() -> None:
    response = client.post("/build?format=stl", json={"spec": _spec()})
    assert response.headers["content-disposition"] == 'attachment; filename="test-bracket-1.stl"'
    spec = _spec()
    spec["name"] = '../"; evil'
    response = client.post("/build?format=glb", json={"spec": spec})
    assert response.headers["content-disposition"] == 'attachment; filename="evil.glb"'


def test_same_request_gives_the_same_bytes() -> None:
    first = client.post("/build?format=step", json={"spec": _spec()}).content
    second = client.post("/build?format=step", json={"spec": _spec()}).content
    assert first == second


def test_anchors_are_used() -> None:
    spec = _spec()
    spec["features"][0]["placement"] = {"anchor": "bolt", "offset_mm": [0, 0, 2]}
    body = {"spec": spec, "anchors": {"bolt": {"point_mm": [100, 0, 0], "normal": [1, 0, 0]}}}
    box = _step_shape(client.post("/build?format=step", json=body).content).BoundingBox()
    assert (box.xmin, box.xmax) == pytest.approx((100, 104), abs=0.01)  # 4 mm plate, 2 mm out


def test_v01_specs_still_build() -> None:
    import json

    spec = json.loads((EXAMPLES / "plate-with-two-holes.json").read_text())
    assert client.post("/build?format=stl", json={"spec": spec}).status_code == 200


def test_unbuildable_spec_gets_a_422_with_plain_errors() -> None:
    spec = _spec()
    spec["features"][1]["position_mm"] = [29, 0]
    response = client.post("/build?format=step", json={"spec": spec})
    assert response.status_code == 422
    assert response.json() == {"errors": ["hole 'h1' at [29, 0] mm is outside plate 'base'"]}


def test_missing_anchor_and_schema_errors_are_reported() -> None:
    spec = _spec()
    spec["features"][0]["placement"] = {"anchor": "nowhere"}
    errors = client.post("/build", json={"spec": spec}).json()["errors"]
    assert errors == ["plate 'base': anchor 'nowhere' was not provided"]
    bad = client.post("/build", json={"spec": {"spec_version": "1.0", "name": "x"}})
    assert bad.status_code == 422
    assert "features" in bad.json()["errors"][0]


def test_malformed_requests_and_formats_are_rejected() -> None:
    assert client.post("/build?format=obj", json={"spec": _spec()}).status_code == 422
    assert client.post("/build", json={"not_a_spec": 1}).status_code == 422
    bad_anchor = {"spec": _spec(), "anchors": {"a": {"point_mm": [1, 2]}}}
    assert client.post("/build", json=bad_anchor).status_code == 422


def test_no_body_still_returns_the_demo_plate() -> None:
    response = client.post("/build?format=glb")
    assert response.status_code == 200
    assert "content-disposition" not in response.headers
