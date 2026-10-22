"""Test fixtures: a synthetic scan with exact ground truth, and a manifest-driven loader.

The synthetic scan is a plate with holes at known positions and diameters, tessellated
finely and then displaced with seeded Gaussian noise. Anchor fitting (B1.5) must recover
the truth within tolerance. The loader reads fixtures/manifest.json. All units are millimeters.
"""

import json
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast

import cadquery as cq
import numpy as np
import trimesh

PLATE_WIDTH_MM = 100.0
PLATE_LENGTH_MM = 60.0
PLATE_THICKNESS_MM = 8.0
HOLES_MM: tuple[tuple[float, float, float], ...] = (
    # (x, y, diameter)
    (-30.0, 15.0, 6.5),
    (0.0, -10.0, 8.0),
    (32.0, 12.0, 10.5),
)
NOISE_MM = 0.05
MAX_EDGE_MM = 2.5
SYNTHETIC_NAME = "synthetic-plate-v1"


@dataclass(frozen=True)
class HoleTruth:
    center_mm: tuple[float, float, float]  # on the top face
    axis: tuple[float, float, float]
    diameter_mm: float


@dataclass(frozen=True)
class SyntheticScan:
    mesh: trimesh.Trimesh
    holes: tuple[HoleTruth, ...]
    top_plane_z_mm: float
    top_plane_normal: tuple[float, float, float]
    noise_mm: float
    seed: int


def make_synthetic_scan(
    seed: int = 0, noise_mm: float = NOISE_MM, max_edge_mm: float = MAX_EDGE_MM
) -> SyntheticScan:
    part = cq.Workplane("XY").box(PLATE_WIDTH_MM, PLATE_LENGTH_MM, PLATE_THICKNESS_MM)
    for x, y, diameter in HOLES_MM:
        # a fresh workplane per hole: chained .center() calls would accumulate offsets
        cutter = (
            cq.Workplane("XY")
            .center(x, y)
            .circle(diameter / 2)
            .extrude(PLATE_THICKNESS_MM, both=True)
        )
        part = part.cut(cutter)
    # tessellate, then split long edges so flat areas have many vertices to carry noise
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "plate.stl"
        cq.exporters.export(part, str(path), tolerance=0.01, angularTolerance=0.05)
        mesh = cast(trimesh.Trimesh, trimesh.load(str(path), force="mesh"))
    vertices, faces = trimesh.remesh.subdivide_to_size(  # type: ignore[no-untyped-call]
        mesh.vertices, mesh.faces, max_edge_mm
    )
    rng = np.random.default_rng(seed)
    noisy = vertices + rng.normal(0.0, noise_mm, size=vertices.shape)
    top = PLATE_THICKNESS_MM / 2
    return SyntheticScan(
        mesh=trimesh.Trimesh(vertices=noisy, faces=faces, process=False),
        holes=tuple(HoleTruth((x, y, top), (0.0, 0.0, 1.0), d) for x, y, d in HOLES_MM),
        top_plane_z_mm=top,
        top_plane_normal=(0.0, 0.0, 1.0),
        noise_mm=noise_mm,
        seed=seed,
    )


def fixtures_dir() -> Path:
    """The fixtures folder: $FIXTURES_DIR, or <repo root>/fixtures."""
    env = os.environ.get("FIXTURES_DIR")
    return Path(env) if env else Path(__file__).resolve().parents[4] / "fixtures"


def load_manifest(directory: Path | None = None) -> dict[str, dict[str, Any]]:
    """Return the manifest's fixtures keyed by name."""
    base = directory or fixtures_dir()
    data = json.loads((base / "manifest.json").read_text())
    return {entry["name"]: entry for entry in data["fixtures"]}


def load_fixture(name: str, directory: Path | None = None) -> SyntheticScan | trimesh.Trimesh:
    """Load a fixture by name: synthetic ones are generated, real ones come from the cache."""
    base = directory or fixtures_dir()
    manifest = load_manifest(base)
    if name not in manifest:
        raise KeyError(f"unknown fixture {name!r}; known: {sorted(manifest)}")
    entry = manifest[name]
    if entry["kind"] == "synthetic":
        if name != SYNTHETIC_NAME:
            raise KeyError(f"no generator for synthetic fixture {name!r}")
        return make_synthetic_scan()
    r2_key = str(entry["r2_key"])
    cached = base / "cache" / Path(r2_key).name
    if not cached.exists():
        raise FileNotFoundError(
            f"real fixture {name!r} is not in {cached}. Download {r2_key!r} from the "
            "R2 dev bucket into that folder (automatic download arrives with B1.1)."
        )
    return cast(trimesh.Trimesh, trimesh.load(str(cached), force="mesh"))
