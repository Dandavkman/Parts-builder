from typing import Annotated, Literal

from fastapi import FastAPI, Query, Response

from geometry import __version__
from geometry.demo_plate import MEDIA_TYPES, build_demo_plate, export_bytes

app = FastAPI(title="Parts Builder geometry service", version=__version__)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": __version__}


@app.post("/build")
def build(format: Annotated[Literal["step", "stl", "glb"], Query()] = "step") -> Response:
    """Build the demo plate and return it in the requested format."""
    data = export_bytes(build_demo_plate(), format)
    return Response(content=data, media_type=MEDIA_TYPES[format])
