import re
from typing import Annotated, Any, Literal

from fastapi import Body, FastAPI, Query, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from geometry import __version__
from geometry.builder import Anchor, SpecError, build_part
from geometry.builder import export_bytes as export_part
from geometry.demo_plate import MEDIA_TYPES, build_demo_plate, export_bytes

app = FastAPI(title="Parts Builder geometry service", version=__version__)

Format = Literal["step", "stl", "glb"]


class AnchorIn(BaseModel):
    """A point picked on the scan and the surface normal there, in millimeters."""

    point_mm: tuple[float, float, float]
    normal: tuple[float, float, float] = (0.0, 0.0, 1.0)


class BuildRequest(BaseModel):
    """A Part Spec (any released version) and the anchors it refers to."""

    spec: dict[str, Any]
    anchors: dict[str, AnchorIn] = Field(default_factory=dict)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": __version__}


def _filename(spec: dict[str, Any], fmt: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", str(spec.get("name", "")).lower()).strip("-")[:60]
    return f"{slug or 'part'}.{fmt}"


@app.post("/build")
def build(
    request: Annotated[BuildRequest | None, Body()] = None,
    format: Annotated[Format, Query()] = "step",
) -> Response:
    """Build a Part Spec and return it as STEP, STL or GLB.

    Without a body, returns the demo plate (the viewer's skeleton check). A spec that cannot be
    built gets a 422 with `{"errors": [...]}`, one plain sentence per problem.
    """
    if request is None:
        return Response(
            content=export_bytes(build_demo_plate(), format), media_type=MEDIA_TYPES[format]
        )
    anchors = {name: Anchor(a.point_mm, a.normal) for name, a in request.anchors.items()}
    try:
        part = build_part(request.spec, anchors)
    except SpecError as error:
        return JSONResponse(status_code=422, content={"errors": error.errors})
    return Response(
        content=export_part(part, format),
        media_type=MEDIA_TYPES[format],
        headers={
            "Content-Disposition": f'attachment; filename="{_filename(request.spec, format)}"'
        },
    )
