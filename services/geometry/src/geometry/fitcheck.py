"""Fit check v1 (B1.10): where a built part overlaps a scan, and by how much.

The scan is a triangle mesh in millimeters whose face normals point out of the car, toward where
parts sit. A negative signed distance means a point is behind the scan surface, inside the car.

Distances come from a dense, seeded sample of the scan surface: the nearest sample gives the
closest point, and the sign comes from that sample's normal. On flat areas this is exact; near
sharp scan edges it can be off by up to about the sample spacing (`scan_spacing_mm`).
"""

import math
from dataclasses import asdict, dataclass, field
from typing import Any

import cadquery as cq
import numpy as np
import trimesh
from numpy.typing import NDArray
from scipy.spatial import cKDTree

from geometry.builder import HolePosition

DEFAULT_TOLERANCE_MM = 0.1
DEFAULT_SCAN_SPACING_MM = 0.5
DEFAULT_PART_EDGE_MM = 1.5
MAX_SCAN_SAMPLES = 1_000_000
NEIGHBOURS = 24
FIT_CHUNK = 20_000
SIDE_NEIGHBOURS = 96
PLANE_RANGE_MM = 2.0
HOLE_SEARCH_RADIUS_MM = 10.0
FULL_RED_MM = 1.0

Floats = NDArray[np.float64]


@dataclass(frozen=True)
class HoleAnchor:
    """A hole picked on the scan (from anchor fitting, B1.5): center, axis and optional diameter."""

    name: str
    center_mm: tuple[float, float, float]
    axis: tuple[float, float, float]
    diameter_mm: float | None = None


@dataclass(frozen=True)
class HoleFit:
    hole: str  # e.g. "ring" or "ring#3" for hole 3 of a pattern
    anchor: str | None  # None when no scan hole is within the search radius
    offset_mm: float | None  # distance between the two centers
    lateral_offset_mm: float | None  # the part of it across the scan hole's axis
    axial_offset_mm: float | None  # the part of it along the axis
    axis_angle_deg: float | None
    diameter_delta_mm: float | None  # scan hole diameter minus part hole diameter


@dataclass(frozen=True)
class FitReport:
    overlaps: bool
    max_overlap_depth_mm: float
    overlap_volume_mm3: (
        float  # estimate: contact area times depth, over faces pushing into the scan
    )
    min_gap_mm: float  # 0 when overlapping
    tolerance_mm: float
    holes: list[HoleFit] = field(default_factory=list)
    vertex_depths_mm: list[float] = field(default_factory=list, repr=False)  # one per mesh vertex
    mesh: trimesh.Trimesh | None = field(default=None, repr=False, compare=False)

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data.pop("mesh")
        return data


def part_mesh(part: cq.Shape, max_edge_mm: float = DEFAULT_PART_EDGE_MM) -> trimesh.Trimesh:
    """Tessellate a part finely enough that overlap shows up on flat faces too."""
    vertices, triangles = part.tessellate(0.01, 0.1)
    v = np.array([[p.x, p.y, p.z] for p in vertices], dtype=float)
    f = np.array(triangles, dtype=np.int64)
    v, f = trimesh.remesh.subdivide_to_size(v, f, max_edge_mm)  # type: ignore[no-untyped-call]
    return trimesh.Trimesh(vertices=v, faces=f, process=True)


class ScanIndex:
    """Signed-distance lookups against a scan mesh."""

    def __init__(self, scan: trimesh.Trimesh, spacing_mm: float = DEFAULT_SCAN_SPACING_MM) -> None:
        count = int(min(MAX_SCAN_SAMPLES, max(1000, scan.area / spacing_mm**2)))
        points, faces = trimesh.sample.sample_surface(scan, count, seed=0)
        self.points: Floats = np.asarray(points, dtype=float)
        self.tree = cKDTree(self.points)
        # Noisy scans have sliver triangles whose own normals are useless. Fit a plane to each
        # sample's neighbours instead, and use the triangle normals only to pick the side.
        # Weight by triangle area again so big, reliable triangles outvote slivers.
        raw = np.asarray(scan.face_normals[faces] * scan.area_faces[faces, None], dtype=float)
        self.normals: Floats = np.empty_like(self.points)
        for start in range(0, count, FIT_CHUNK):
            chunk = slice(start, start + FIT_CHUNK)
            _, near = self.tree.query(self.points[chunk], k=NEIGHBOURS)
            _, wide = self.tree.query(self.points[chunk], k=SIDE_NEIGHBOURS)
            self.normals[chunk] = _fit_normals(self.points[near], raw[wide].sum(axis=1))

    def signed_distance(self, query: Floats) -> tuple[Floats, Floats]:
        """(signed distance in mm, scan normal there) for each query point.

        Close to the scan the distance is to the local plane through the nearest samples, which is
        exact on flat areas whatever the sample spacing. Further away it is the plain distance to
        the nearest sample, signed by that sample's normal.
        """
        dist, near = self.tree.query(query, k=NEIGHBOURS)
        centroid = self.points[near].mean(axis=1)
        normal = _unit(self.normals[near].mean(axis=1))
        plane = np.einsum("ij,ij->i", query - centroid, normal)
        nearest = dist[:, 0]
        sign = np.where(
            np.einsum("ij,ij->i", query - self.points[near[:, 0]], normal) >= 0, 1.0, -1.0
        )
        return np.where(nearest < PLANE_RANGE_MM, plane, sign * nearest), normal


def _fit_normals(neighbours: Floats, side: Floats) -> Floats:
    """Plane normals of point groups (n, k, 3), turned to face the same way as `side` (n, 3)."""
    centered = neighbours - neighbours.mean(axis=1, keepdims=True)
    _, vectors = np.linalg.eigh(np.einsum("nki,nkj->nij", centered, centered))
    normal: Floats = vectors[:, :, 0]  # smallest eigenvalue: the direction the points vary least in
    flip = np.einsum("ij,ij->i", normal, side) < 0
    return np.where(flip[:, None], -normal, normal)


def _unit(v: Floats) -> Floats:
    length = np.linalg.norm(v, axis=1, keepdims=True)
    return np.asarray(v / np.where(length == 0, 1.0, length), dtype=float)


def check_fit(
    part: cq.Shape,
    scan: trimesh.Trimesh | ScanIndex,
    holes: list[HolePosition] | None = None,
    hole_anchors: list[HoleAnchor] | None = None,
    tolerance_mm: float = DEFAULT_TOLERANCE_MM,
    scan_spacing_mm: float = DEFAULT_SCAN_SPACING_MM,
) -> FitReport:
    """Compare a built part with a scan. Overlaps under `tolerance_mm` count as touching.

    Pass a `ScanIndex` instead of a mesh to check many versions of a part against one scan.
    """
    mesh = part_mesh(part)
    index = scan if isinstance(scan, ScanIndex) else ScanIndex(scan, scan_spacing_mm)

    depth_of_vertices, _ = index.signed_distance(np.asarray(mesh.vertices, dtype=float))
    vertex_depths = np.maximum(0.0, -depth_of_vertices)
    max_depth = float(vertex_depths.max()) if len(vertex_depths) else 0.0
    overlaps = max_depth > tolerance_mm

    # Area-weighted samples on the part, for the gap and the volume estimate.
    samples, face_ids = trimesh.sample.sample_surface(
        mesh, max(1000, int(mesh.area / 0.25)), seed=0
    )
    signed, scan_normals = index.signed_distance(np.asarray(samples, dtype=float))
    pushing = np.einsum("ij,ij->i", mesh.face_normals[face_ids], scan_normals) < 0
    depth = np.maximum(0.0, -signed)
    area_per_sample = mesh.area / len(samples)
    volume = float(np.sum(depth[pushing]) * area_per_sample) if overlaps else 0.0
    min_gap = 0.0 if overlaps else max(0.0, float(min(signed.min(), np.min(depth_of_vertices))))

    return FitReport(
        overlaps=overlaps,
        max_overlap_depth_mm=round(max_depth, 4),
        overlap_volume_mm3=round(volume, 3),
        min_gap_mm=round(min_gap, 4),
        tolerance_mm=tolerance_mm,
        holes=fit_holes(holes or [], hole_anchors or []),
        vertex_depths_mm=[round(float(d), 4) for d in vertex_depths],
        mesh=mesh,
    )


def fit_holes(holes: list[HolePosition], anchors: list[HoleAnchor]) -> list[HoleFit]:
    """Pair each part hole with the nearest scan hole within the search radius."""
    fits: list[HoleFit] = []
    for h in holes:
        name = (
            h.feature_id
            if h.index == 1 and not _is_pattern(holes, h)
            else f"{h.feature_id}#{h.index}"
        )
        best: tuple[float, HoleAnchor] | None = None
        for a in anchors:
            d = float(np.linalg.norm(np.subtract(h.center_mm, a.center_mm)))
            if d <= HOLE_SEARCH_RADIUS_MM and (best is None or d < best[0]):
                best = (d, a)
        if best is None:
            fits.append(HoleFit(name, None, None, None, None, None, None))
            continue
        d, a = best
        axis = np.asarray(a.axis, dtype=float) / np.linalg.norm(a.axis)
        delta = np.subtract(h.center_mm, a.center_mm)
        axial = float(np.dot(delta, axis))
        lateral = float(np.linalg.norm(delta - axial * axis))
        part_axis = np.asarray(h.axis, dtype=float) / np.linalg.norm(h.axis)
        angle = math.degrees(math.acos(max(-1.0, min(1.0, abs(float(np.dot(part_axis, axis)))))))
        fits.append(
            HoleFit(
                name,
                a.name,
                round(d, 4),
                round(lateral, 4),
                round(axial, 4),
                round(angle, 3),
                None if a.diameter_mm is None else round(a.diameter_mm - h.diameter_mm, 4),
            )
        )
    return fits


def _is_pattern(holes: list[HolePosition], h: HolePosition) -> bool:
    return sum(1 for o in holes if o.feature_id == h.feature_id) > 1


def heatmap_glb(report: FitReport, full_red_mm: float = FULL_RED_MM) -> bytes:
    """The part as a GLB, colored grey where clear and red where it sinks into the scan."""
    if report.mesh is None:
        raise ValueError("the report has no mesh")
    t = np.clip(np.asarray(report.vertex_depths_mm) / full_red_mm, 0.0, 1.0)
    grey = np.array([200.0, 200.0, 200.0])
    red = np.array([220.0, 30.0, 30.0])
    colors = (grey[None, :] * (1 - t[:, None]) + red[None, :] * t[:, None]).astype(np.uint8)
    rgba = np.hstack([colors, np.full((len(colors), 1), 255, dtype=np.uint8)])
    colored = trimesh.Trimesh(
        vertices=report.mesh.vertices, faces=report.mesh.faces, vertex_colors=rgba, process=False
    )
    data = colored.export(file_type="glb")
    assert isinstance(data, bytes)
    return data
