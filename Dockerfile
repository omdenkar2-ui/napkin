FROM python:3.11-slim AS base

COPY --from=ghcr.io/astral-sh/uv:0.13.1 /uv /uvx /bin/

WORKDIR /app

ENV PATH="/opt/venv/bin:$PATH" \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Python deps (install first for layer caching)
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

# App code
COPY app/ app/
COPY migrations/ migrations/

# Non-root user
RUN useradd -m napkin && chown -R napkin:napkin /app
USER napkin

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD python -c "import httpx; r=httpx.get('http://localhost:8000/health'); assert r.status_code==200"

# Single worker — APScheduler runs in-process, multiple workers = duplicate jobs
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
