# Geometry service

Stateless Python service for scan processing, Part Spec builds and checks. All units are millimeters. The web app is the only service that writes to the database.

```
uv sync
uv run ruff check . && uv run ruff format --check . && uv run mypy src tests && uv run pytest
```
