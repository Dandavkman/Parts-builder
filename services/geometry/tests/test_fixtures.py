import json
from pathlib import Path

import numpy as np
import pytest
import trimesh

from geometry.fixtures import (
    HOLES_MM,
    NOISE_MM,
    PLATE_LENGTH_MM,
    PLATE_THICKNESS_MM,
    PLATE_WIDTH_MM,
    SYNTHETIC_NAME,
    SyntheticScan,
    load_fixture,
    load_manifest,
    make_synthetic_scan,
)


@pytest.fixture(scope="module")
def scan() -> SyntheticScan:
    return make_synthetic_scan()


def test_scan_is_dense_enough_for_fitting(scan: SyntheticScan) -> None:
    assert len(scan.mesh.vertices) > 20_000


def test_scan_bounds_match_the_plate(scan: SyntheticScan) -> None:
    lo, hi = scan.mesh.bounds
    size = hi - lo
    assert size[0] == pytest.approx(PLATE_WIDTH_MM, abs=0.5)
    assert size[1] == pytest.approx(PLATE_LENGTH_MM, abs=0.5)
    assert size[2] == pytest.approx(PLATE_THICKNESS_MM, abs=0.5)


def test_top_face_noise_matches_the_stated_sigma(scan: SyntheticScan) -> None:
    v = scan.mesh.vertices
    on_top = v[np.abs(v[:, 2] - scan.top_plane_z_mm) < 5 * NOISE_MM]
    assert len(on_top) > 5_000
    assert on_top[:, 2].mean() == pytest.approx(scan.top_plane_z_mm, abs=0.01)
    assert on_top[:, 2].std() == pytest.approx(NOISE_MM, rel=0.25)


def test_holes_are_empty_in_the_scan(scan: SyntheticScan) -> None:
    v = scan.mesh.vertices
    for hole in scan.holes:
        dist = np.hypot(v[:, 0] - hole.center_mm[0], v[:, 1] - hole.center_mm[1])
        inside = dist < hole.diameter_mm / 2 - 6 * NOISE_MM
        assert not inside.any()


def test_hole_wall_vertices_sit_on_the_true_radius(scan: SyntheticScan) -> None:
    v = scan.mesh.vertices
    for hole in scan.holes:
        dist = np.hypot(v[:, 0] - hole.center_mm[0], v[:, 1] - hole.center_mm[1])
        wall = v[np.abs(dist - hole.diameter_mm / 2) < 5 * NOISE_MM]
        assert len(wall) > 50
        wall_dist = np.hypot(wall[:, 0] - hole.center_mm[0], wall[:, 1] - hole.center_mm[1])
        assert wall_dist.mean() == pytest.approx(hole.diameter_mm / 2, abs=0.02)


def test_ground_truth_matches_the_definition(scan: SyntheticScan) -> None:
    assert [(h.center_mm[0], h.center_mm[1], h.diameter_mm) for h in scan.holes] == list(HOLES_MM)
    assert all(h.axis == (0.0, 0.0, 1.0) for h in scan.holes)
    assert scan.top_plane_z_mm == PLATE_THICKNESS_MM / 2


def test_same_seed_gives_identical_scans_and_other_seeds_differ() -> None:
    a = make_synthetic_scan(seed=1, max_edge_mm=6.0)
    b = make_synthetic_scan(seed=1, max_edge_mm=6.0)
    c = make_synthetic_scan(seed=2, max_edge_mm=6.0)
    assert np.array_equal(a.mesh.vertices, b.mesh.vertices)
    assert not np.array_equal(a.mesh.vertices, c.mesh.vertices)


def test_manifest_lists_the_synthetic_fixture() -> None:
    assert SYNTHETIC_NAME in load_manifest()


def test_loader_returns_the_synthetic_scan() -> None:
    loaded = load_fixture(SYNTHETIC_NAME)
    assert isinstance(loaded, SyntheticScan)
    assert len(loaded.holes) == len(HOLES_MM)


def test_loader_rejects_unknown_names() -> None:
    with pytest.raises(KeyError, match="unknown fixture"):
        load_fixture("no-such-fixture")


def _manifest_with_real_fixture(tmp_path: Path) -> Path:
    (tmp_path / "manifest.json").write_text(
        json.dumps(
            {
                "version": 1,
                "fixtures": [
                    {
                        "name": "real-test",
                        "kind": "real",
                        "r2_key": "fixtures/real-test.stl",
                        "description": "test",
                    }
                ],
            }
        )
    )
    return tmp_path


def test_real_fixture_missing_from_cache_explains_how_to_get_it(tmp_path: Path) -> None:
    base = _manifest_with_real_fixture(tmp_path)
    with pytest.raises(FileNotFoundError, match="R2 dev bucket"):
        load_fixture("real-test", base)


def test_real_fixture_loads_from_cache(tmp_path: Path) -> None:
    base = _manifest_with_real_fixture(tmp_path)
    (base / "cache").mkdir()
    trimesh.creation.box(extents=(10, 10, 10)).export(str(base / "cache" / "real-test.stl"))
    mesh = load_fixture("real-test", base)
    assert isinstance(mesh, trimesh.Trimesh)
    assert mesh.volume == pytest.approx(1000.0, rel=0.001)
