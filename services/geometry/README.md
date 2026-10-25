# Geometry service

Stateless Python service for scan processing, Part Spec builds and checks. All units are millimeters. The web app is the only service that writes to the database.

## Run

```
uv sync
uv run uvicorn geometry.api:app --port 8000
curl http://localhost:8000/health
curl -X POST "http://localhost:8000/build?format=step" -o plate.step   # also stl, glb
```

`/build` currently returns a hard-coded 50 x 30 x 4 mm plate with two 6.5 mm holes. The Part Spec builder lives in `geometry.builder` (see `docs/part-spec.md`) and is not wired to the API yet. `geometry.fitcheck` compares a built part with a scan (see `docs/fit-check.md`).

## Checks

```
uv run ruff check . && uv run ruff format --check . && uv run mypy src tests && uv run pytest
```
