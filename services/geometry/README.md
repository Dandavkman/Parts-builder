# Geometry service

Stateless Python service for scan processing, Part Spec builds and checks. All units are millimeters. The web app is the only service that writes to the database.

## Run

```
uv sync
uv run uvicorn geometry.api:app --port 8000
curl http://localhost:8000/health
curl -X POST "http://localhost:8000/build?format=step" -o plate.step   # demo plate; also stl, glb
python -c "import json,sys; print(json.dumps({'spec': json.load(open('src/geometry/spec/examples/v1/hole.json'))}))" \
  | curl -X POST "http://localhost:8000/build?format=stl" -H "Content-Type: application/json" -d @- -o part.stl
```

`POST /build?format=step|stl|glb` builds a Part Spec. Send `{"spec": {...}, "anchors": {"name": {"point_mm": [x, y, z], "normal": [x, y, z]}}}` (anchors are optional) and the file comes back with a download filename. A spec that cannot be built gets a 422 with `{"errors": [...]}`. With no body it returns the hard-coded 50 x 30 x 4 mm demo plate with two 6.5 mm holes, which the viewer uses. The Part Spec builder lives in `geometry.builder` (see `docs/part-spec.md`). `geometry.fitcheck` compares a built part with a scan (see `docs/fit-check.md`).

## Checks

```
uv run ruff check . && uv run ruff format --check . && uv run mypy src tests && uv run pytest
```
