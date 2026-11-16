"""The /render picture sheet the design agent compares with the user's photo."""

import json
import struct
import zlib
from pathlib import Path
from typing import Any

import numpy as np
from fastapi.testclient import TestClient

from geometry.api import app
from geometry.builder import build_part, export_bytes
from geometry.render import (
    BACKGROUND,
    EDGE_COLOR,
    PANEL_H,
    PANEL_W,
    SCALE_BAR_COLOR,
    camera_direction,
    render_sheet,
    scale_bar_mm,
)

client = TestClient(app)
EXAMPLES = Path(__file__).parent.parent / "src" / "geometry" / "spec" / "examples"


def _decode(png: bytes) -> np.ndarray:
    assert png[:8] == b"\x89PNG\r\n\x1a\n"
    pos, idat = 8, b""
    width = height = 0
    while pos < len(png):
        (length,) = struct.unpack(">I", png[pos : pos + 4])
        kind = png[pos + 4 : pos + 8]
        body = png[pos + 8 : pos + 8 + length]
        if kind == b"IHDR":
            width, height = struct.unpack(">II", body[:8])
        elif kind == b"IDAT":
            idat += body
        pos += 12 + length
    raw = zlib.decompress(idat)
    rows = [
        np.frombuffer(raw[i * (width * 3 + 1) + 1 : (i + 1) * (width * 3 + 1)], np.uint8)
        for i in range(height)
    ]
    return np.stack(rows).reshape(height, width, 3)


def _wing() -> dict[str, Any]:
    return json.loads((EXAMPLES / "v4_3" / "cad-wing-from-outlines.json").read_text())  # type: ignore[no-any-return]


def _filled(panel: np.ndarray) -> int:
    inner = panel[2:-2, 2:-2]
    return int((np.abs(inner.astype(int) - np.array(BACKGROUND)).sum(axis=2) > 0).sum())


def test_sheet_is_a_two_by_two_png_with_something_in_every_panel() -> None:
    image = _decode(render_sheet(export_bytes(build_part(_wing()), "stl")))
    assert image.shape == (PANEL_H * 2, PANEL_W * 2, 3)
    for row in (0, 1):
        for col in (0, 1):
            panel = image[row * PANEL_H : (row + 1) * PANEL_H, col * PANEL_W : (col + 1) * PANEL_W]
            assert _filled(panel) > 500, (row, col)


def test_views_differ_and_front_shows_the_wide_span() -> None:
    image = _decode(render_sheet(export_bytes(build_part(_wing()), "stl")))
    front = image[:PANEL_H, :PANEL_W]
    side = image[:PANEL_H, PANEL_W:]
    columns = np.where(
        (np.abs(front.astype(int) - np.array(BACKGROUND)).sum(axis=2) > 0)[5:-5, 5:-5].any(axis=0)
    )[0]
    # The 1000 mm wing fills the panel width in the front view.
    assert columns.max() - columns.min() > PANEL_W * 0.8
    assert not np.array_equal(front, side)


def test_render_is_deterministic() -> None:
    stl = export_bytes(build_part(_wing()), "stl")
    assert render_sheet(stl) == render_sheet(stl)


def test_endpoint_returns_png_and_plain_errors(monkeypatch: Any) -> None:
    monkeypatch.setenv("GEOMETRY_AUTH_DISABLED", "1")
    ok = client.post("/render", json={"spec": _wing()})
    assert ok.status_code == 200
    assert ok.headers["content-type"] == "image/png"
    assert ok.content[:8] == b"\x89PNG\r\n\x1a\n"
    bad = client.post(
        "/render",
        json={
            "spec": {"spec_version": "4.3", "name": "x", "features": [{"id": "a", "type": "nope"}]}
        },
    )
    assert bad.status_code == 422
    assert bad.json()["errors"]


def test_endpoint_needs_the_token(monkeypatch: Any) -> None:
    monkeypatch.delenv("GEOMETRY_AUTH_DISABLED", raising=False)
    monkeypatch.setenv("GEOMETRY_SERVICE_TOKEN", "secret")
    assert client.post("/render", json={"spec": _wing()}).status_code == 401
    ok = client.post("/render", json={"spec": _wing()}, headers={"Authorization": "Bearer secret"})
    assert ok.status_code == 200


def _panel(image: np.ndarray, row: int, col: int) -> np.ndarray:
    return image[row * PANEL_H : (row + 1) * PANEL_H, col * PANEL_W : (col + 1) * PANEL_W]


def test_scale_bar_is_a_round_length_and_drawn_in_every_panel() -> None:
    assert [scale_bar_mm(v) for v in (1000, 280, 60, 9, 0.4)] == [200, 50, 10, 1, 0.05]
    image = _decode(render_sheet(export_bytes(build_part(_wing()), "stl")))
    widths = []
    for row, col in ((0, 0), (0, 1), (1, 0), (1, 1)):
        bar = (_panel(image, row, col)[PANEL_H - 11] == np.array(SCALE_BAR_COLOR)).all(axis=1)
        widths.append(int(bar.sum()))
    assert all(w > 10 for w in widths)
    # The side view is zoomed in more than the front view, so the same length is a longer bar.
    assert widths[1] > widths[0]


def test_edges_are_drawn() -> None:
    image = _decode(render_sheet(export_bytes(build_part(_wing()), "stl")))
    assert int((image == np.array(EDGE_COLOR)).all(axis=2).sum()) > 200


def test_camera_direction_matches_the_fixed_views() -> None:
    front, _ = camera_direction(0, 0)
    assert np.allclose(front, (0, 1, 0))
    right, _ = camera_direction(90, 0)
    assert np.allclose(right, (-1, 0, 0), atol=1e-9)
    above, _ = camera_direction(0, 89)
    assert above[2] < -0.99


def test_a_given_view_changes_only_the_fourth_panel() -> None:
    stl = export_bytes(build_part(_wing()), "stl")
    default = _decode(render_sheet(stl))
    chosen = _decode(render_sheet(stl, (200.0, 10.0)))
    for row, col in ((0, 0), (0, 1), (1, 0)):
        assert np.array_equal(_panel(default, row, col), _panel(chosen, row, col))
    assert not np.array_equal(_panel(default, 1, 1), _panel(chosen, 1, 1))
    assert _filled(_panel(chosen, 1, 1)) > 500


def test_endpoint_accepts_a_view_and_rejects_a_bad_one(monkeypatch: Any) -> None:
    monkeypatch.setenv("GEOMETRY_AUTH_DISABLED", "1")
    plain = client.post("/render", json={"spec": _wing()})
    viewed = client.post(
        "/render", json={"spec": _wing(), "view": {"azimuth_deg": 200, "elevation_deg": 10}}
    )
    assert viewed.status_code == 200
    assert viewed.content != plain.content
    assert plain.headers["x-scale-bar-mm"] == "200"
    bad = client.post(
        "/render", json={"spec": _wing(), "view": {"azimuth_deg": 0, "elevation_deg": 200}}
    )
    assert bad.status_code == 422
