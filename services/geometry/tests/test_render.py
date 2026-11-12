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
from geometry.render import BACKGROUND, PANEL_H, PANEL_W, render_sheet

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
