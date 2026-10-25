# Geometry service image for Fly.io. Build context is this folder (services/geometry).
FROM python:3.12-slim

# The 3D engine (OpenCascade, via cadquery) needs these system libraries.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /usr/local/bin/uv

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PATH="/app/.venv/bin:$PATH"

# Dependencies first, so code changes do not reinstall the 3D engine.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY src ./src
COPY README.md ./
RUN uv sync --frozen --no-dev

EXPOSE 8080
CMD ["uvicorn", "geometry.api:app", "--host", "0.0.0.0", "--port", "8080"]
