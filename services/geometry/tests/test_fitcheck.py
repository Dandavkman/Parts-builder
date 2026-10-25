import io
import json
from typing import Any, cast

import numpy as np
import pytest
import trimesh

from geometry.builder import Anchor, build_part, hole_positions
from geometry.fitcheck import HoleAnchor, ScanIndex, check_fit, heatmap_glb
from geometry.fixtures import make_synthetic_scan

TOP_Z_MM = 4.0  # the synthetic plate's top face


@pytest.fixture(scope="module")
def noisy() -> ScanIndex:
    return ScanIndex(make_synthetic_scan().mesh)


@pytest.fixture(scope="module")
def clean() -> ScanIndex:
    return ScanIndex(make_synthetic_scan(noise_mm=0.0).mesh)


def _plate_spec(rest_z_mm: float, extra: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    """A 40 x 30 x 4 plate whose mid-plane is `rest_z_mm` above the scan origin."""
    plate = {
        "id": "base",
        "type": "plate",
        "outline": {"kind": "rectangle", "width_mm": 40, "length_mm": 30},
        "thickness_mm": 4,
        "placement": {"anchor": "origin", "offset_mm": [0, 0, rest_z_mm]},
    }
    return {"spec_version": "1.0", "name": "fit", "features": [plate, *(extra or [])]}


RESTING_Z_MM = TOP_Z_MM + 2  # bottom face exactly on the scan's top face


def test_part_one_mm_into_the_scan_is_flagged_with_the_right_depth(clean: ScanIndex) -> None:
    report = check_fit(build_part(_plate_spec(RESTING_Z_MM - 1)), clean)
    assert report.overlaps
    assert report.max_overlap_depth_mm == pytest.approx(1.0, abs=0.02)
    assert report.min_gap_mm == 0
    assert report.overlap_volume_mm3 == pytest.approx(
        40 * 30 * 1 - 8 * 8 * 3.14159 / 4 * 1, rel=0.1
    )


def test_depth_is_right_on_a_noisy_scan_too(noisy: ScanIndex) -> None:
    report = check_fit(build_part(_plate_spec(RESTING_Z_MM - 1)), noisy)
    assert report.overlaps
    assert report.max_overlap_depth_mm == pytest.approx(1.0, abs=0.15)


def test_part_resting_on_the_scan_does_not_overlap(clean: ScanIndex, noisy: ScanIndex) -> None:
    for scan in (clean, noisy):
        report = check_fit(build_part(_plate_spec(RESTING_Z_MM)), scan)
        assert not report.overlaps
        assert report.max_overlap_depth_mm < 0.1
        assert report.overlap_volume_mm3 == 0


def test_gap_when_floating(clean: ScanIndex, noisy: ScanIndex) -> None:
    for scan, tolerance in ((clean, 0.02), (noisy, 0.15)):
        report = check_fit(build_part(_plate_spec(RESTING_Z_MM + 2)), scan)
        assert not report.overlaps
        assert report.min_gap_mm == pytest.approx(2.0, abs=tolerance)


def test_small_overlaps_inside_tolerance_count_as_touching(clean: ScanIndex) -> None:
    spec = _plate_spec(RESTING_Z_MM - 0.05)
    assert not check_fit(build_part(spec), clean).overlaps
    assert check_fit(build_part(spec), clean, tolerance_mm=0.01).overlaps


def test_signed_distance_is_negative_inside_the_car(clean: ScanIndex) -> None:
    index = clean
    query = np.array([[10.0, 10.0, 6.0], [10.0, 10.0, 3.0], [10.0, 10.0, -5.0], [60.0, 0.0, 0.0]])
    signed, _ = index.signed_distance(query)
    assert signed == pytest.approx([2.0, -1.0, 1.0, 10.0], abs=0.05)


def test_heat_map_is_red_only_where_the_part_sinks_in(clean: ScanIndex) -> None:
    report = check_fit(build_part(_plate_spec(RESTING_Z_MM - 1)), clean)
    assert report.mesh is not None
    assert len(report.vertex_depths_mm) == len(report.mesh.vertices)
    for vertex, depth in zip(report.mesh.vertices, report.vertex_depths_mm, strict=True):
        if vertex[2] > TOP_Z_MM + 1.5:  # the part's top face is 3 mm above the scan
            assert depth == 0
    assert max(report.vertex_depths_mm) == pytest.approx(1.0, abs=0.02)

    scene = cast(trimesh.Scene, trimesh.load(io.BytesIO(heatmap_glb(report)), file_type="glb"))
    colors = np.asarray(next(iter(scene.geometry.values())).visual.vertex_colors)
    reddest = colors[:, 0].astype(int) - colors[:, 1].astype(int)
    assert reddest.max() > 150 and reddest.min() == 0


def test_report_is_json_serializable(clean: ScanIndex) -> None:
    data = check_fit(build_part(_plate_spec(RESTING_Z_MM - 1)), clean).to_dict()
    assert "mesh" not in data
    json.dumps(data)


def test_same_inputs_give_the_same_report(noisy: ScanIndex) -> None:
    spec = _plate_spec(RESTING_Z_MM - 1)
    first = check_fit(build_part(spec), noisy).to_dict()
    second = check_fit(build_part(spec), noisy).to_dict()
    assert first == second


def _hole_spec() -> dict[str, Any]:
    holes = [
        {"id": "h1", "type": "hole", "plate": "base", "diameter_mm": 6.5, "position_mm": [-10, 5]},
        {
            "id": "ring",
            "type": "hole_pattern",
            "plate": "base",
            "diameter_mm": 4,
            "pattern": {
                "kind": "rectangular",
                "count_x": 2,
                "count_y": 1,
                "spacing_x_mm": 20,
                "spacing_y_mm": 1,
            },
        },
    ]
    spec = _plate_spec(RESTING_Z_MM, holes)
    spec["features"][0]["placement"]["offset_mm"] = [1, 2, RESTING_Z_MM]
    return spec


def test_hole_positions_follow_the_placement() -> None:
    found = {(h.feature_id, h.index): h for h in hole_positions(_hole_spec())}
    assert found[("h1", 1)].center_mm == pytest.approx((-9, 7, RESTING_Z_MM + 2))
    assert found[("ring", 1)].center_mm == pytest.approx((-9, 2, RESTING_Z_MM + 2))
    assert found[("ring", 2)].center_mm == pytest.approx((11, 2, RESTING_Z_MM + 2))
    assert found[("h1", 1)].axis == pytest.approx((0, 0, 1))


def test_hole_positions_use_rotation_and_anchor_normal() -> None:
    spec = _hole_spec()
    spec["features"][0]["placement"] = {"anchor": "side", "offset_mm": [0, 0, 0]}
    found = hole_positions(spec, {"side": Anchor((50.0, 0.0, 0.0), (1.0, 0.0, 0.0))})
    assert found[0].axis == pytest.approx((1, 0, 0))
    assert found[0].center_mm[0] == pytest.approx(52)  # the plate's top face is 2 mm out


def test_holes_are_paired_with_the_nearest_scan_hole(noisy: ScanIndex, clean: ScanIndex) -> None:
    holes = hole_positions(_hole_spec())
    anchors = [
        HoleAnchor("scan_a", (-9.5, 7.0, 4.0), (0, 0, 1), 6.0),
        HoleAnchor("far_away", (80.0, 0.0, 4.0), (0, 0, 1)),
    ]
    report = check_fit(build_part(_hole_spec()), clean, holes, anchors)
    by_name = {h.hole: h for h in report.holes}
    first = by_name["h1"]
    assert first.anchor == "scan_a"
    assert first.offset_mm == pytest.approx((0.5**2 + 4**2) ** 0.5, abs=0.01)
    assert first.lateral_offset_mm == pytest.approx(0.5, abs=0.01)
    assert first.axial_offset_mm == pytest.approx(4.0, abs=0.01)
    assert first.axis_angle_deg == pytest.approx(0.0, abs=0.01)
    assert first.diameter_delta_mm == pytest.approx(-0.5)
    assert by_name["ring#1"].anchor == "scan_a"
    assert by_name["ring#2"].anchor is None  # nothing within the search radius
