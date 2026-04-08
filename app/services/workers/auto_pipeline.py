"""
Auto Pipeline Worker — Checks for unprocessed feedback and runs the pipeline.
Runs every 6 hours via APScheduler. Can also be triggered immediately by webhooks.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import structlog

from app.db.client import get_supabase_admin

logger = structlog.get_logger(__name__)

# Minimum new feedback items before auto-triggering
MIN_NEW_ITEMS = 5

# Cooldown: don't auto-run if a session was created recently
MIN_HOURS_BETWEEN_SESSIONS = 6

# Lower threshold for webhook-triggered checks
WEBHOOK_MIN_ITEMS = 3
WEBHOOK_COOLDOWN_HOURS = 1


async def check_and_run_pipeline() -> None:
    """
    Scheduled job: check all projects for unprocessed feedback.
    If a project has MIN_NEW_ITEMS+ raw items and no recent session,
    auto-create a session and run the pipeline.
    """
    db = get_supabase_admin()

    try:
        projects = db.table("projects").select("id, name").execute()
        if not projects.data:
            return

        for project in projects.data:
            try:
                await _check_project(
                    db,
                    project["id"],
                    project.get("name", "unknown"),
                    min_items=MIN_NEW_ITEMS,
                    cooldown_hours=MIN_HOURS_BETWEEN_SESSIONS,
                )
            except Exception as exc:
                logger.error("auto_pipeline_project_failed",
                             project_id=project["id"], error=str(exc))

        # Auto-archive old completed sessions
        try:
            from app.services.session_lifecycle import auto_archive_old_sessions
            await auto_archive_old_sessions()
        except Exception as exc:
            logger.warning("auto_archive_failed", error=str(exc))

    except Exception as exc:
        logger.error("auto_pipeline_check_failed", error=str(exc))


async def trigger_pipeline_now(project_id: str) -> dict:
    """
    Immediate trigger — called by webhook scrapers (WhatsApp, Intercom)
    when real-time feedback arrives. Uses lower threshold and shorter cooldown.
    """
    try:
        db = get_supabase_admin()
        return await _check_project(
            db,
            project_id,
            "webhook-triggered",
            min_items=WEBHOOK_MIN_ITEMS,
            cooldown_hours=WEBHOOK_COOLDOWN_HOURS,
        )
    except Exception as exc:
        logger.error("trigger_pipeline_now_failed", project_id=project_id, error=str(exc))
        return {"status": "error", "error": str(exc)}


async def _check_project(
    db,
    project_id: str,
    project_name: str,
    min_items: int = MIN_NEW_ITEMS,
    cooldown_hours: int = MIN_HOURS_BETWEEN_SESSIONS,
) -> dict:
    """Check a single project and run pipeline if criteria met."""

    # 1. Count unprocessed feedback items
    unprocessed = (
        db.table("feedback_items")
        .select("id", count="exact")
        .eq("project_id", project_id)
        .eq("status", "raw")
        .execute()
    )
    count = unprocessed.count if hasattr(unprocessed, "count") else len(unprocessed.data or [])

    if count < min_items:
        logger.debug("auto_pipeline_skip_insufficient",
                      project=project_name, unprocessed=count, minimum=min_items)
        return {"status": "queued", "unprocessed": count, "minimum": min_items}

    # 2. Check cooldown
    cutoff = (datetime.now(UTC) - timedelta(hours=cooldown_hours)).isoformat()
    recent = (
        db.table("sessions")
        .select("id")
        .eq("project_id", project_id)
        .gte("created_at", cutoff)
        .limit(1)
        .execute()
    )
    if recent.data:
        logger.debug("auto_pipeline_skip_cooldown",
                      project=project_name, cooldown_hours=cooldown_hours)
        return {"status": "cooldown", "hours": cooldown_hours}

    # 3. Concurrency lock: skip if a pipeline is already running for this project
    active = (
        db.table("sessions")
        .select("id")
        .eq("project_id", project_id)
        .eq("status", "active")
        .neq("stage", "done")
        .neq("stage", "error")
        .limit(1)
        .execute()
    )
    if active.data:
        logger.info("pipeline_skip_active_run", project_id=project_id)
        return {"status": "skip_active_run", "active_session": active.data[0]["id"]}

    # 4. Auto-create session
    logger.info("auto_pipeline_triggering", project=project_name, unprocessed=count)

    # Get created_by from the project
    proj = db.table("projects").select("created_by").eq("id", project_id).single().execute()
    created_by = proj.data.get("created_by") if proj.data else None
    if not created_by:
        logger.error("auto_pipeline_no_creator", project=project_name)
        return {"status": "error", "message": "No project creator found"}

    session_id = str(uuid4())
    session_title = f"Auto — {datetime.now(UTC).strftime('%b %d %H:%M')}"

    db.table("sessions").insert({
        "id": session_id,
        "project_id": project_id,
        "created_by": created_by,
        "title": session_title,
        "stage": "intake",
        "status": "active",
        "stage_history": [{"stage": "intake", "entered_at": datetime.now(UTC).isoformat()}],
    }).execute()

    # 4. Run pipeline in background task (don't block the scheduler)
    from app.services.agents.orchestrator import run_pipeline_from_stored_feedback

    try:
        result = await run_pipeline_from_stored_feedback(project_id, session_id)
        logger.info("auto_pipeline_complete",
                     project=project_name, session_id=session_id,
                     processed=result.get("processed", 0))
        return {"status": "triggered", "session_id": session_id, "processed": result.get("processed", 0)}

    except Exception as exc:
        logger.error("auto_pipeline_run_failed",
                      project=project_name, session_id=session_id, error=str(exc))
        db.table("sessions").update({
            "stage": "error",
            "status": "error",
            "messages": [{"role": "system", "content": f"Auto-pipeline failed: {exc}"}],
        }).eq("id", session_id).execute()
        return {"status": "error", "error": str(exc)}
