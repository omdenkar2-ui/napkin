"""
Napkin — Health Check Route
Reports dependency status for monitoring.
"""

from datetime import UTC, datetime

from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    settings = get_settings()
    checks: dict[str, str] = {}

    # Database check
    try:
        from app.db.client import get_supabase_admin
        db = get_supabase_admin()
        db.table("projects").select("id").limit(1).execute()
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {str(e)[:100]}"

    # LLM check (config only — no actual API call)
    try:
        from app.core.llm import get_strong_llm
        get_strong_llm()
        checks["llm"] = "configured"
    except Exception as e:
        checks["llm"] = f"error: {str(e)[:100]}"

    # Scheduler check
    try:
        import apscheduler  # noqa: F401
        checks["scheduler"] = "configured"
    except ImportError:
        checks["scheduler"] = "not installed"

    healthy = all(v in ("ok", "configured") for v in checks.values())

    return {
        "status": "healthy" if healthy else "degraded",
        "checks": checks,
        "version": "1.0.0",
        "environment": settings.app_env.value,
        "timestamp": datetime.now(UTC).isoformat(),
    }


@router.get("/")
async def root():
    return {
        "name": "napkin",
        "tagline": "From napkin to product.",
        "docs": "/docs",
    }
