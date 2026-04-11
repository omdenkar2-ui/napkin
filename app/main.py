"""
Napkin Backend — Main Application
FastAPI app with all routes, middleware, and lifecycle hooks.

"Cursor builds what you tell it to build. Napkin figures out what that should be."
"""

import logging
from contextlib import asynccontextmanager

import time

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

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


def _recover_stuck_sessions():
    """Mark orphaned sessions as error on startup.

    Any session with status='active' and stage not in ('done','error') is
    definitionally stuck — all asyncio tasks from the previous process are gone.
    """
    from datetime import UTC, datetime
    from app.db.client import get_supabase_admin

    db = get_supabase_admin()
    stuck = (
        db.table("sessions")
        .select("id")
        .eq("status", "active")
        .neq("stage", "done")
        .neq("stage", "error")
        .execute()
    )

    if not stuck.data:
        return 0

    stuck_ids = [s["id"] for s in stuck.data]
    now = datetime.now(UTC).isoformat()

    for sid in stuck_ids:
        db.table("sessions").update({
            "stage": "error",
            "status": "error",
            "messages": [{
                "role": "assistant",
                "content": "Analysis was interrupted. Click Retry to resume.",
                "timestamp": now,
            }],
        }).eq("id", sid).execute()

    return len(stuck_ids)


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

    # Recover sessions stuck from a previous crash/restart
    try:
        recovered = _recover_stuck_sessions()
        if recovered:
            logger.info("recovered_stuck_sessions", count=recovered)
    except Exception as exc:
        logger.warning("recovery_failed", error=str(exc))

    # Startup: Initialize Sentry if configured
    if settings.sentry_dsn:
        import sentry_sdk
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.app_env.value,
            traces_sample_rate=0.1 if settings.is_production else 1.0,
        )

    # Startup: Start background scheduler (auto-sync + auto-pipeline)
    scheduler = None
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.interval import IntervalTrigger
        from apscheduler.triggers.cron import CronTrigger
        from app.services.workers.auto_pipeline import check_and_run_pipeline
        from app.services.workers.auto_sync import sync_all_sources
        from app.services.workers.weekly_worker import generate_all_briefs
        from app.services.workers.github_checker import check_github_issues

        scheduler = AsyncIOScheduler()

        scheduler.add_job(
            sync_all_sources,
            IntervalTrigger(hours=6),
            id="auto_sync",
            name="Auto-sync all connected data sources",
            replace_existing=True,
        )

        scheduler.add_job(
            check_and_run_pipeline,
            IntervalTrigger(hours=6, start_date="2026-01-01 00:30:00"),  # offset 30min after sync
            id="auto_pipeline",
            name="Auto-run pipeline on new feedback",
            replace_existing=True,
        )

        scheduler.add_job(
            generate_all_briefs,
            CronTrigger(day_of_week="mon", hour=8),
            id="weekly_brief",
            name="Generate weekly briefs for all projects",
            replace_existing=True,
        )

        scheduler.add_job(
            check_github_issues,
            IntervalTrigger(hours=12),
            id="github_checker",
            name="Check if Napkin-created GitHub issues were closed",
            replace_existing=True,
        )

        scheduler.start()
        logger.info("scheduler_started", jobs=[
            "auto_sync (6h)", "auto_pipeline (6h)",
            "weekly_brief (Mon 8am)", "github_checker (12h)",
        ])
    except ImportError:
        logger.warning("scheduler_skipped", reason="apscheduler not installed")
    except Exception as exc:
        logger.warning("scheduler_start_failed", error=str(exc))

    yield

    # Shutdown: stop scheduler
    if scheduler:
        scheduler.shutdown(wait=False)
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

    # --- Rate Limiting ---
    try:
        from slowapi import Limiter, _rate_limit_exceeded_handler
        from slowapi.util import get_remote_address
        from slowapi.errors import RateLimitExceeded

        limiter = Limiter(key_func=get_remote_address)
        app.state.limiter = limiter
        app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    except ImportError:
        pass  # slowapi optional

    # --- Request Logging (slow request detection) ---
    _log = structlog.get_logger("http")

    class _LoggingMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request: Request, call_next):
            start = time.time()
            response = await call_next(request)
            duration = time.time() - start
            if duration > 5.0:
                _log.warning("slow_request",
                             path=request.url.path,
                             method=request.method,
                             duration=round(duration, 2),
                             status=response.status_code)
            return response

    app.add_middleware(_LoggingMiddleware)

    # --- CORS ---
    allowed_origins = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://usenapkin.com",
    ]
    if settings.frontend_url:
        allowed_origins.append(settings.frontend_url)
    if settings.cors_origins:
        allowed_origins.extend(o.strip() for o in settings.cors_origins.split(",") if o.strip())

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
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
    from app.api.routes.integrations import router as integrations_router
    from app.api.routes.chat import router as chat_router
    from app.api.routes.actions import router as actions_router
    from app.api.routes.briefs import router as briefs_router

    app.include_router(health_router)
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(sessions_router, prefix="/api/v1")
    app.include_router(projects_router, prefix="/api/v1")
    app.include_router(feedback_router, prefix="/api/v1")
    app.include_router(specs_router, prefix="/api/v1")
    app.include_router(artifacts_router, prefix="/api/v1")
    app.include_router(integrations_router, prefix="/api/v1")
    app.include_router(chat_router, prefix="/api/v1")
    app.include_router(actions_router, prefix="/api/v1")
    app.include_router(briefs_router, prefix="/api/v1")

    # DEV ONLY: bypass auth for local testing
    if not settings.is_production:
        _setup_dev_auth_bypass(app)

    return app


app = create_app()
