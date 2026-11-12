"""Pictures of a built part for the design agent: a contact sheet of four views.

A small software renderer (numpy only, no GPU, no new dependencies): orthographic cameras, a depth
buffer and flat shading. The sheet is one PNG, 2 x 2 panels, in this fixed order:
front (top left), side (top right), top (bottom left), angled (bottom right).
Front looks along +Y with +X to the right; side looks along -X with +Y to the right; top looks
down with +X to the right and +Y up; angled looks from the front, right and above.
"""

import struct
import zlib
from collections.abc import Sequence
from io import BytesIO
from typing import cast

import numpy as np
import numpy.typing as npt
import trimesh

PANEL_W = 480
PANEL_H = 360
PADDING_PX = 24
BACKGROUND = (30, 32, 36)
BORDER = (70, 74, 82)
BASE_COLOR = (214, 190, 96)
VIEW_NAMES = ("front", "side", "top", "angled")

_Array = npt.NDArray[np.float64]


def _unit(v: Sequence[float] | _Array) -> _Array:
    a = np.asarray(v, dtype=np.float64)
    return a / np.linalg.norm(a)


# (direction the camera looks along, up hint)
_VIEWS: dict[str, tuple[_Array, _Array]] = {
    "front": (_unit((0, 1, 0)), _unit((0, 0, 1))),
    "side": (_unit((-1, 0, 0)), _unit((0, 0, 1))),
    "top": (_unit((0, 0, -1)), _unit((0, 1, 0))),
    "angled": (_unit((-0.55, 0.75, -0.45)), _unit((0, 0, 1))),
}


def _render_panel(
    vertices: _Array, faces: npt.NDArray[np.int64], view: str
) -> npt.NDArray[np.uint8]:
    look, up = _VIEWS[view]
    right = _unit(np.cross(look, up))
    true_up = np.cross(right, look)
    sx = vertices @ right
    sy = vertices @ true_up
    depth = vertices @ look
    span_x = max(float(sx.max() - sx.min()), 1e-6)
    span_y = max(float(sy.max() - sy.min()), 1e-6)
    scale = min((PANEL_W - 2 * PADDING_PX) / span_x, (PANEL_H - 2 * PADDING_PX) / span_y)
    px = (sx - (sx.max() + sx.min()) / 2) * scale + PANEL_W / 2
    py = PANEL_H / 2 - (sy - (sy.max() + sy.min()) / 2) * scale

    image = np.empty((PANEL_H, PANEL_W, 3), dtype=np.uint8)
    image[:] = BACKGROUND
    zbuf = np.full((PANEL_H, PANEL_W), np.inf)
    tri = vertices[faces]
    normals = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    length = np.linalg.norm(normals, axis=1)
    normals = normals / np.where(length == 0, 1, length)[:, None]
    # Headlight plus a light from above-left, so faces toward the camera are bright.
    light = _unit(-look + 0.6 * true_up - 0.4 * right)
    shade = 0.25 + 0.75 * np.clip(np.abs(normals @ light), 0, 1)
    colors = np.clip(np.outer(shade, BASE_COLOR), 0, 255).astype(np.uint8)

    for i, f in enumerate(faces):
        if length[i] == 0:
            continue
        x = px[f]
        y = py[f]
        x0 = max(int(np.floor(x.min())), 0)
        x1 = min(int(np.ceil(x.max())), PANEL_W - 1)
        y0 = max(int(np.floor(y.min())), 0)
        y1 = min(int(np.ceil(y.max())), PANEL_H - 1)
        if x1 < x0 or y1 < y0:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        den = (y[1] - y[2]) * (x[0] - x[2]) + (x[2] - x[1]) * (y[0] - y[2])
        if abs(den) < 1e-9:
            # Edge-on triangle: nothing to draw at this angle.
            continue
        w0 = ((y[1] - y[2]) * (gx - x[2]) + (x[2] - x[1]) * (gy - y[2])) / den
        w1 = ((y[2] - y[0]) * (gx - x[2]) + (x[0] - x[2]) * (gy - y[2])) / den
        w2 = 1 - w0 - w1
        inside = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6)
        if not inside.any():
            continue
        z = w0 * depth[f[0]] + w1 * depth[f[1]] + w2 * depth[f[2]]
        window = zbuf[y0 : y1 + 1, x0 : x1 + 1]
        nearer = inside & (z < window)
        window[nearer] = z[nearer]
        image[y0 : y1 + 1, x0 : x1 + 1][nearer] = colors[i]

    image[0, :] = BORDER
    image[-1, :] = BORDER
    image[:, 0] = BORDER
    image[:, -1] = BORDER
    return image


def _png(rgb: npt.NDArray[np.uint8]) -> bytes:
    height, width, _ = rgb.shape
    raw = b"".join(b"\x00" + rgb[row].tobytes() for row in range(height))

    def chunk(kind: bytes, data: bytes) -> bytes:
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 6))
        + chunk(b"IEND", b"")
    )


def render_sheet(stl: bytes) -> bytes:
    """Four views of the part (see the module notes) as one PNG, from its binary STL bytes."""
    mesh = cast(trimesh.Trimesh, trimesh.load(BytesIO(stl), file_type="stl", force="mesh"))
    vertices = np.asarray(mesh.vertices, dtype=np.float64)
    faces = np.asarray(mesh.faces, dtype=np.int64)
    if len(faces) == 0:
        raise ValueError("The part has no surface to draw.")
    panels = [_render_panel(vertices, faces, name) for name in VIEW_NAMES]
    top = np.concatenate(panels[:2], axis=1)
    bottom = np.concatenate(panels[2:], axis=1)
    return _png(np.concatenate([top, bottom], axis=0))
