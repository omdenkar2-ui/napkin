"""
Napkin — Health Check Route
"""

from datetime import UTC, datetime

from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    settings = get_settings()
    return {
        "status": "ok",
        "version": "0.1.0",
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
