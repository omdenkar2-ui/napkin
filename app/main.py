"""
Napkin Backend — Main Application
FastAPI app with all routes, middleware, and lifecycle hooks.

"Cursor builds what you tell it to build. Napkin figures out what that should be."
"""

import logging
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings


def _configure_logging():
    """Configure structured logging (called once at startup, not at import time)."""
    settings = get_settings()
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.dev.set_exc_info,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer() if not settings.is_production
            else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.getLevelName(settings.log_level)
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle — startup and shutdown hooks."""
    _configure_logging()
    logger = structlog.get_logger()

    settings = get_settings()
    logger.info(
        "napkin_starting",
        environment=settings.app_env.value,
        debug=settings.app_debug,
    )

    # Startup: Initialize Sentry if configured
    if settings.sentry_dsn:
        import sentry_sdk
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.app_env.value,
            traces_sample_rate=0.1 if settings.is_production else 1.0,
        )

    yield

    logger.info("napkin_shutting_down")


def _setup_dev_auth_bypass(app: FastAPI):
    """
    DEV ONLY: Override auth dependencies to return the existing test user.
    Remove this for production.
    """
    from uuid import UUID
    from app.api.deps.auth import get_current_user, get_current_user_id

    # Use the existing Supabase profile + org
    TEST_USER_ID = "b09cd7f7-8d95-49a5-b928-54eae6c6a6c3"
    TEST_ORG_ID = "00000000-0000-0000-0000-000000000010"

    TEST_USER = {
        "id": TEST_USER_ID,
        "email": "omdenkar2@gmail.com",
        "full_name": "Test User",
        "org_id": TEST_ORG_ID,
        "role": "owner",
    }

    async def _fake_user():
        return TEST_USER

    async def _fake_user_id():
        return UUID(TEST_USER_ID)

    app.dependency_overrides[get_current_user] = _fake_user
    app.dependency_overrides[get_current_user_id] = _fake_user_id
    print("[dev-auth] Auth bypass enabled — all requests use test user")


def create_app() -> FastAPI:
    """Application factory."""
    settings = get_settings()

    app = FastAPI(
        title="napkin",
        description="The intelligence layer between customer reality and code.",
        version="0.1.0",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        lifespan=lifespan,
    )

    # --- CORS ---
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://localhost:5173",
            "https://usenapkin.com",
        ],
        allow_origin_regex=r"https://.*\.usenapkin\.com",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # --- Routes ---
    from app.api.routes.auth import router as auth_router
    from app.api.routes.health import router as health_router
    from app.api.routes.projects import feedback_router, projects_router
    from app.api.routes.sessions import router as sessions_router
    from app.api.routes.specs import artifacts_router, specs_router

    app.include_router(health_router)
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(sessions_router, prefix="/api/v1")
    app.include_router(projects_router, prefix="/api/v1")
    app.include_router(feedback_router, prefix="/api/v1")
    app.include_router(specs_router, prefix="/api/v1")
    app.include_router(artifacts_router, prefix="/api/v1")

    # DEV ONLY: bypass auth for local testing
    if not settings.is_production:
        _setup_dev_auth_bypass(app)

    return app


app = create_app()
