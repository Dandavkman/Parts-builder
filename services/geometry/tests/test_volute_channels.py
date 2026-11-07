"""Part Spec 4.4: divided-scroll turbo housings (volute channels)."""

import copy
import json
from pathlib import Path
from typing import Any

import pytest

from geometry.builder import SpecError, build_part

EXAMPLE = (
    Path(__file__).parent.parent
    / "src"
    / "geometry"
    / "spec"
    / "examples"
    / "v4_4"
    / "four-channel-volute.json"
)


def _spec(**volute: Any) -> dict[str, Any]:
    spec: dict[str, Any] = json.loads(EXAMPLE.read_text())
    spec["features"][0].update(volute)
    return spec


def _build(spec: dict[str, Any]) -> Any:
    return build_part(spec, {})


def test_four_channel_housing_is_one_valid_solid() -> None:
    part = _build(_spec())
    assert part.isValid()
    assert len(part.Solids()) == 1


def test_old_single_channel_housing_is_unchanged_by_the_new_code() -> None:
    old = json.loads(
        (Path(EXAMPLE).parent.parent / "v3_2" / "gt2871-style-volute.json").read_text()
    )
    new = copy.deepcopy(old)
    new["spec_version"] = "4.4"
    a, b = _build(old), _build(new)
    assert a.Volume() == pytest.approx(b.Volume(), rel=1e-6)


@pytest.mark.parametrize("channels", [2, 4])
def test_each_channel_has_its_own_inlet_and_flanges_fit(channels: int) -> None:
    flanges = [
        {
            "id": f"f{i}",
            "type": "flange",
            "tube": "housing",
            "end": f"inlet_{i}",
            "outline": {"kind": "circle", "diameter_mm": 50},
            "thickness_mm": 8,
        }
        for i in range(1, channels + 1)
    ]
    spec = _spec(channels=channels)
    spec["features"].extend(flanges)
    part = _build(spec)
    assert part.isValid()
    assert len(part.Solids()) == 1


def test_flange_on_the_old_inlet_name_is_refused_for_a_divided_housing() -> None:
    spec = _spec(channels=2)
    spec["features"].append(
        {
            "id": "f",
            "type": "flange",
            "tube": "housing",
            "end": "inlet",
            "outline": {"kind": "circle", "diameter_mm": 50},
            "thickness_mm": 8,
        }
    )
    with pytest.raises(SpecError, match="inlet_1"):
        _build(spec)


def test_more_channels_means_narrower_passages() -> None:
    single = _spec(channels=1)
    del single["features"][0]["inlet_diameter_mm"]
    four = _spec(channels=4)
    del four["features"][0]["inlet_diameter_mm"]
    assert _build(four).Volume() > _build(single).Volume() * 0.3


def test_channels_that_run_into_each_other_are_refused() -> None:
    with pytest.raises(SpecError, match="run into each other"):
        _build(_spec(inlet_diameter_mm=100))
