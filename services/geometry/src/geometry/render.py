"""Pictures of a built part for the design agent: a contact sheet of four views.

A small software renderer (numpy only, no GPU, no new dependencies): orthographic cameras, a depth
buffer and flat shading. The sheet is one PNG, 2 x 2 panels, in this fixed order:
front (top left), side (top right), top (bottom left), angled (bottom right).
Front looks along +Y with +X to the right; side looks along -X with +Y to the right; top looks
down with +X to the right and +Y up; angled looks from the front, right and above.

Each panel is zoomed to fit on its own, so a small side view is not lost beside a wide front view.
To compare lengths between panels, every panel has a white scale bar in its bottom left corner
that stands for the same length (`scale_bar_mm`, a round number near a fifth of the part's longest
side). When the caller gives a `view` (where the camera that took the user's photo stood), the
fourth panel looks from there instead of the default angle. Dark lines mark sharp edges and steps
in depth.
"""

import math
import struct
import zlib
from collections.abc import Sequence
from io import BytesIO
from typing import cast

import numpy as np
import numpy.typing as npt
import trimesh

PANEL_W = 640
PANEL_H = 480
PADDING_PX = 24
BACKGROUND = (30, 32, 36)
BORDER = (70, 74, 82)
BASE_COLOR = (214, 190, 96)
EDGE_COLOR = (22, 18, 8)
SCALE_BAR_COLOR = (235, 235, 235)
# Faces that meet at more than this angle get a line between them; tessellated curves stay smooth.
CREASE_DEG = 25.0
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


def camera_direction(azimuth_deg: float, elevation_deg: float) -> tuple[_Array, _Array]:
    """The (look, up hint) of a camera standing around the part.

    Azimuth is where the camera stands, seen from above: 0 in front of the part (the front view),
    90 at its right (+X), 180 behind, 270 at its left. Elevation is how far above level it is:
    0 level with the part, 90 straight above, negative below.
    """
    az = math.radians(azimuth_deg)
    el = math.radians(max(-89.0, min(89.0, elevation_deg)))
    stands = np.array([math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)])
    return _unit(-stands), _unit((0, 0, 1))


def _axes(look: _Array, up: _Array) -> tuple[_Array, _Array]:
    right = _unit(np.cross(look, up))
    return right, np.cross(right, look)


def _fit_scale(vertices: _Array, look: _Array, up: _Array) -> float:
    right, true_up = _axes(look, up)
    sx = vertices @ right
    sy = vertices @ true_up
    span_x = max(float(sx.max() - sx.min()), 1e-6)
    span_y = max(float(sy.max() - sy.min()), 1e-6)
    return min((PANEL_W - 2 * PADDING_PX) / span_x, (PANEL_H - 2 * PADDING_PX) / span_y)


def _render_panel(
    vertices: _Array,
    faces: npt.NDArray[np.int64],
    look: _Array,
    up: _Array,
    bar_mm: float,
) -> npt.NDArray[np.uint8]:
    right, true_up = _axes(look, up)
    sx = vertices @ right
    sy = vertices @ true_up
    depth = vertices @ look
    scale = _fit_scale(vertices, look, up)
    px = (sx - (sx.max() + sx.min()) / 2) * scale + PANEL_W / 2
    py = PANEL_H / 2 - (sy - (sy.max() + sy.min()) / 2) * scale

    image = np.empty((PANEL_H, PANEL_W, 3), dtype=np.uint8)
    image[:] = BACKGROUND
    zbuf = np.full((PANEL_H, PANEL_W), np.inf)
    face_at = np.full((PANEL_H, PANEL_W), -1, dtype=np.int64)
    tri = vertices[faces]
    normals = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    length = np.linalg.norm(normals, axis=1)
    normals = normals / np.where(length == 0, 1, length)[:, None]
    # Headlight plus a light from above-left, so faces toward the camera are bright.
    light = _unit(-look + 0.6 * true_up - 0.4 * right)
    shade = 0.45 + 0.55 * np.clip(np.abs(normals @ light), 0, 1)
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
        face_at[y0 : y1 + 1, x0 : x1 + 1][nearer] = i

    _draw_edges(image, zbuf, face_at, normals, float(np.ptp(depth)))
    # The scale bar: the same length in every panel, with a tick at each end.
    bar_px = max(int(round(bar_mm * scale)), 2)
    x0, y0 = 10, PANEL_H - 12
    x1 = min(x0 + bar_px, PANEL_W - 2)
    image[y0 : y0 + 3, x0:x1] = SCALE_BAR_COLOR
    image[y0 - 4 : y0 + 7, x0 : x0 + 2] = SCALE_BAR_COLOR
    image[y0 - 4 : y0 + 7, x1 - 2 : x1] = SCALE_BAR_COLOR

    image[0, :] = BORDER
    image[-1, :] = BORDER
    image[:, 0] = BORDER
    image[:, -1] = BORDER
    return image


def _draw_edges(
    image: npt.NDArray[np.uint8],
    zbuf: _Array,
    face_at: npt.NDArray[np.int64],
    normals: _Array,
    depth_range: float,
) -> None:
    """Darkens pixels where faces meet at a sharp angle or one surface sits in front of another."""
    crease = math.cos(math.radians(CREASE_DEG))
    step = max(depth_range, 1e-6) * 0.02
    edge = np.zeros(face_at.shape, dtype=bool)
    for dy, dx in ((0, 1), (1, 0)):
        a = face_at[: PANEL_H - dy, : PANEL_W - dx]
        b = face_at[dy:, dx:]
        both = (a >= 0) & (b >= 0)
        sharp = np.einsum("...k,...k->...", normals[a], normals[b]) < crease
        za = np.where(both, zbuf[: PANEL_H - dy, : PANEL_W - dx], 0.0)
        zb = np.where(both, zbuf[dy:, dx:], 0.0)
        found = both & (a != b) & (sharp | (np.abs(za - zb) > step))
        edge[: PANEL_H - dy, : PANEL_W - dx] |= found
    image[edge] = EDGE_COLOR


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


def scale_bar_mm(longest_mm: float) -> float:
    """A round length (1, 2 or 5 times a power of ten) near a fifth of the part's longest side."""
    target = max(longest_mm, 1e-6) / 5
    power = 10 ** math.floor(math.log10(target))
    return float(max(m for m in (1, 2, 5) if m * power <= target) * power)


def sheet_scale_bar_mm(stl: bytes) -> float:
    """The length the white bar in each panel stands for, for this part."""
    mesh = cast(trimesh.Trimesh, trimesh.load(BytesIO(stl), file_type="stl", force="mesh"))
    return scale_bar_mm(float(np.ptp(np.asarray(mesh.vertices, dtype=np.float64), axis=0).max()))


def render_sheet(stl: bytes, view: tuple[float, float] | None = None) -> bytes:
    """Four views of the part (see the module notes) as one PNG, from its binary STL bytes.

    `view` is (azimuth_deg, elevation_deg) for the fourth panel; see `camera_direction`.
    """
    mesh = cast(trimesh.Trimesh, trimesh.load(BytesIO(stl), file_type="stl", force="mesh"))
    vertices = np.asarray(mesh.vertices, dtype=np.float64)
    faces = np.asarray(mesh.faces, dtype=np.int64)
    if len(faces) == 0:
        raise ValueError("The part has no surface to draw.")
    cameras = [_VIEWS[name] for name in VIEW_NAMES]
    if view is not None:
        cameras[3] = camera_direction(*view)
    bar_mm = scale_bar_mm(float(np.ptp(vertices, axis=0).max()))
    panels = [_render_panel(vertices, faces, look, up, bar_mm) for look, up in cameras]
    top = np.concatenate(panels[:2], axis=1)
    bottom = np.concatenate(panels[2:], axis=1)
    return _png(np.concatenate([top, bottom], axis=0))
