"""Part Spec 2.0 solid bodies (B1.17a). Volumes are checked against hand calculations."""

import copy
import json
import math
from pathlib import Path
from typing import Any

import pytest
from jsonschema import Draft202012Validator

from geometry.builder import SpecError, build_part
from geometry.builder.spec_io import validate_schema

SPEC_DIR = Path(__file__).parent.parent / "src" / "geometry" / "spec"
V2 = json.loads((SPEC_DIR / "part-spec.v2.schema.json").read_text())
EXAMPLES = sorted((SPEC_DIR / "examples" / "v2").glob("*.json"))


def _example(name: str) -> dict[str, Any]:
    return copy.deepcopy(json.loads((SPEC_DIR / "examples" / "v2" / f"{name}.json").read_text()))


def test_v2_schema_is_valid() -> None:
    Draft202012Validator.check_schema(V2)


@pytest.mark.parametrize("path", EXAMPLES, ids=lambda p: p.stem)
def test_every_v2_example_validates_and_builds(path: Path) -> None:
    spec = json.loads(path.read_text())
    validate_schema(spec)
    part = build_part(spec)
    assert part.isValid()
    assert len(part.Solids()) == 1


@pytest.mark.parametrize(
    "path", sorted((SPEC_DIR / "examples" / "v1").glob("*.json")), ids=lambda p: p.stem
)
def test_every_v1_example_is_valid_as_v2(path: Path) -> None:
    spec = json.loads(path.read_text())
    spec["spec_version"] = "2.0"
    Draft202012Validator(V2).validate(spec)


def test_v1_1_rejects_a_body() -> None:
    spec = _example("body-box")
    spec["spec_version"] = "1.1"
    with pytest.raises(SpecError):
        validate_schema(spec)


def test_storyboard_vase_matches_hand_calculation() -> None:
    part = build_part(_example("body-vase"))
    bb = part.BoundingBox()
    assert (bb.xlen, bb.ylen, bb.zlen) == pytest.approx((80, 80, 200), abs=1e-6)
    corner = 4 - math.pi
    outer = (80 * 80 - corner * 6**2) * 200
    cavity = (76 * 76 - corner * 4**2) * 198  # walls 2 mm, floor 2 mm
    # a 1 mm fillet on the outer top and bottom edges removes (1 - pi/4) * r^2 per mm of edge
    perimeter = 4 * (80 - 12) + 2 * math.pi * 6
    fillet = 2 * (1 - math.pi / 4) * perimeter
    assert part.Volume() == pytest.approx(outer - cavity - fillet, rel=1e-3)


def test_open_box_volume_and_height() -> None:
    part = build_part(_example("body-box"))
    corner = 4 - math.pi
    outer = (60 * 40 - corner * 4**2) * 30
    cavity = (56 * 36 - corner * 2**2) * 28
    assert part.Volume() == pytest.approx(outer - cavity, rel=1e-6)
    assert part.BoundingBox().zmin == pytest.approx(0, abs=1e-9)


def test_cylinder_with_fillet() -> None:
    part = build_part(_example("body-cylinder"))
    plain = math.pi * 15**2 * 20
    assert part.Volume() < plain
    fillet = (
        2 * (1 - math.pi / 4) * 2**2 * 2 * math.pi * 15
    )  # two edges, radius 2 mm, circumference
    assert part.Volume() == pytest.approx(plain - fillet, rel=2e-2)


def test_polygon_body_and_closed_hollow() -> None:
    spec = _example("body-box")
    shape = spec["features"][0]["shape"]
    shape["outline"] = {"kind": "polygon", "points_mm": [[-20, -20], [20, -20], [0, 25]]}
    spec["features"][0]["shell"]["open"] = "none"
    part = build_part(spec)
    assert part.isValid()
    solid_volume = _triangle_area([(-20, -20), (20, -20), (0, 25)]) * 30
    assert 0 < part.Volume() < solid_volume


def _triangle_area(p: list[tuple[float, float]]) -> float:
    (x1, y1), (x2, y2), (x3, y3) = p
    return abs((x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2)) / 2)


def test_body_is_placed_on_its_anchor() -> None:
    from geometry.builder import Anchor

    spec = _example("body-cylinder")
    spec["features"][0]["placement"] = {"anchor": "mount", "offset_mm": [0, 0, 5]}
    part = build_part(spec, {"mount": Anchor((100.0, 0.0, 0.0))})
    bb = part.BoundingBox()
    assert (bb.zmin, bb.zmax) == pytest.approx((5, 25), abs=1e-6)
    assert bb.xmin == pytest.approx(85, abs=1e-6)


def test_same_spec_gives_same_geometry() -> None:
    a, b = build_part(_example("body-vase")), build_part(_example("body-vase"))
    assert a.Volume() == b.Volume()


def _thin_and_tall(f: dict[str, Any]) -> None:
    f["shape"].update(height_mm=10)
    f["shell"].update(wall_thickness_mm=12)


@pytest.mark.parametrize(
    ("change", "message"),
    [
        (lambda f: f["shell"].update(wall_thickness_mm=40), "leave no room inside"),
        (_thin_and_tall, "too large for height_mm"),
        (lambda f: f.update(edge_fillet_mm=3), "less than the wall thickness"),
        (lambda f: f["shape"]["outline"].update(corner_radius_mm=25), "larger than half"),
        (lambda f: f["placement"].update(anchor="missing"), "anchor 'missing' was not provided"),
    ],
)
def test_clear_errors(change: Any, message: str) -> None:
    spec = _example("body-box")
    spec["features"][0]["shell"]["wall_thickness_mm"] = 2
    change(spec["features"][0])
    with pytest.raises(SpecError) as error:
        build_part(spec)
    assert any(message in e for e in error.value.errors)


def test_a_plate_can_sit_beside_a_body() -> None:
    spec = _example("body-box")
    spec["features"].append(
        {
            "id": "lid",
            "type": "plate",
            "outline": {"kind": "rectangle", "width_mm": 60, "length_mm": 40},
            "thickness_mm": 2,
            "placement": {"anchor": "origin", "offset_mm": [0, 80, 0]},
        }
    )
    assert len(build_part(spec).Solids()) == 2


@pytest.mark.parametrize(
    "name",
    ["body-box", "body-cylinder", "body-vase", "body-revolve-vase", "body-revolve-knob"],
)
def test_golden(name: str) -> None:
    """Summaries live in tests/golden; regenerate with UPDATE_GOLDEN=1 and review the diff."""
    import os

    bb = (part := build_part(_example(name))).BoundingBox()
    summary = {
        "volume_mm3": round(part.Volume(), 2),
        "bbox_mm": [round(v, 3) for v in (bb.xmin, bb.xmax, bb.ymin, bb.ymax, bb.zmin, bb.zmax)],
        "faces": len(part.Faces()),
        "solids": len(part.Solids()),
    }
    path = Path(__file__).parent / "golden" / f"{name}.json"
    if os.environ.get("UPDATE_GOLDEN"):
        path.write_text(json.dumps(summary, indent=2) + "\n")
    expected = json.loads(path.read_text())
    assert summary["faces"] == expected["faces"]
    assert summary["solids"] == expected["solids"]
    assert summary["volume_mm3"] == pytest.approx(expected["volume_mm3"], abs=0.05)
    assert summary["bbox_mm"] == pytest.approx(expected["bbox_mm"], abs=0.001)


def _revolve_vase() -> dict[str, Any]:
    return _example("body-revolve-vase")


def test_revolved_knob_matches_frustum_volumes() -> None:
    part = build_part(_example("body-revolve-knob"))
    cylinder = math.pi * 18**2 * 4
    lower = math.pi * 18 / 3 * (18**2 + 18 * 14 + 14**2)
    upper = math.pi * 8 / 3 * (14**2 + 14 * 12 + 12**2)
    # 1.5 mm fillets on the top and bottom edges take off a little under 100 mm3
    assert part.Volume() == pytest.approx(cylinder + lower + upper, rel=6e-3)
    bb = part.BoundingBox()
    assert (bb.xlen, bb.zlen) == pytest.approx((36, 30), abs=1e-6)


def test_revolved_vase_agrees_with_the_kernel_shell() -> None:
    import cadquery as cq

    spec = _revolve_vase()
    profile = spec["features"][0]["shape"]["profile_mm"]
    points = [(0, 0), *map(tuple, profile), (0, profile[-1][1])]
    outer = cq.Workplane("XZ").polyline(points).close().revolve(360, (0, 0, 0), (0, 1, 0))
    reference = outer.faces(">Z").shell(-2.5).findSolid().Volume()
    part = build_part(spec)
    assert part.Volume() == pytest.approx(reference, rel=1e-2)
    bb = part.BoundingBox()
    assert (bb.xlen, bb.zlen) == pytest.approx((80, 200), abs=1e-6)


def test_revolved_vase_is_open_at_the_top() -> None:
    """A thin slice at the very top has a hole in it, a slice at the base does not."""
    import cadquery as cq

    part = build_part(_revolve_vase())
    probe = cq.Workplane("XY", origin=(0, 0, 195)).circle(5).extrude(2).findSolid()
    assert part.intersect(probe).Volume() == pytest.approx(0, abs=1e-6)
    base = cq.Workplane("XY", origin=(0, 0, 0.5)).circle(5).extrude(1).findSolid()
    assert part.intersect(base).Volume() == pytest.approx(math.pi * 25, rel=1e-6)


def test_closed_revolved_hollow_has_an_inner_void() -> None:
    spec = _revolve_vase()
    spec["features"][0]["shell"]["open"] = "none"
    part = build_part(spec)
    assert part.isValid()
    assert part.Volume() > build_part(_revolve_vase()).Volume()


@pytest.mark.parametrize(
    ("profile", "message"),
    [
        ([[30, 0], [30, 0]], "z in profile_mm must increase"),
        ([[30, 0], [40, 50], [30, 40]], "z in profile_mm must increase"),
        ([[0, 0], [30, 50]], "every radius in profile_mm must be greater than 0"),
        ([[2, 0], [2, 50]], "leave no room inside the profile"),
    ],
)
def test_revolve_errors(profile: list[list[float]], message: str) -> None:
    spec = _revolve_vase()
    spec["features"][0]["shape"]["profile_mm"] = profile
    with pytest.raises(SpecError) as error:
        build_part(spec)
    assert any(message in e for e in error.value.errors)
