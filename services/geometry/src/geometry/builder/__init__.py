"""Part Spec builder (B1.7): Part Spec JSON in, exact geometry out."""

from geometry.builder.core import HolePosition, build_part, hole_positions
from geometry.builder.errors import SpecError
from geometry.builder.export import FORMATS, MEDIA_TYPES, export_bytes
from geometry.builder.placement import Anchor

__all__ = [
    "FORMATS",
    "MEDIA_TYPES",
    "Anchor",
    "HolePosition",
    "SpecError",
    "build_part",
    "export_bytes",
    "hole_positions",
]
