FROM python:3.11-slim AS base

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Python deps (install first for layer caching)
COPY pyproject.toml .
RUN pip install --no-cache-dir .

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
