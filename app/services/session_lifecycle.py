"""
Session Lifecycle — Archive, resolve patterns, auto-cleanup.
Keeps the workspace clean and prevents resurfacing solved problems.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import structlog

from app.db.client import get_supabase_admin

logger = structlog.get_logger(__name__)

# Sessions older than this are auto-archived
AUTO_ARCHIVE_DAYS = 30


async def archive_session(session_id: str) -> dict:
    """Archive a completed session. Hidden from active views but still in DB."""
    db = get_supabase_admin()

    result = (
        db.table("sessions")
        .update({"archived_at": datetime.now(UTC).isoformat()})
        .eq("id", session_id)
        .is_("archived_at", "null")
        .execute()
    )

    if result.data:
        logger.info("session_archived", session_id=session_id)
        return {"status": "archived", "session_id": session_id}
    return {"status": "already_archived_or_not_found"}


async def unarchive_session(session_id: str) -> dict:
    """Restore an archived session back to active."""
    db = get_supabase_admin()

    result = (
        db.table("sessions")
        .update({"archived_at": None})
        .eq("id", session_id)
        .execute()
    )

    if result.data:
        logger.info("session_unarchived", session_id=session_id)
        return {"status": "unarchived", "session_id": session_id}
    return {"status": "not_found"}


async def resolve_pattern(pattern_cluster_id: str, spec_id: str) -> dict:
    """Mark a pattern as resolved — it won't be resurfaced in future synthesis."""
    db = get_supabase_admin()

    result = (
        db.table("pattern_clusters")
        .update({
            "resolved": True,
            "resolved_by_spec_id": spec_id,
            "resolved_at": datetime.now(UTC).isoformat(),
        })
        .eq("id", pattern_cluster_id)
        .execute()
    )

    if result.data:
        logger.info("pattern_resolved", pattern_id=pattern_cluster_id, spec_id=spec_id)
        return {"status": "resolved"}
    return {"status": "not_found"}


async def unresolve_pattern(pattern_cluster_id: str) -> dict:
    """Mark a pattern as unresolved again (e.g. fix was reverted)."""
    db = get_supabase_admin()

    result = (
        db.table("pattern_clusters")
        .update({
            "resolved": False,
            "resolved_by_spec_id": None,
            "resolved_at": None,
        })
        .eq("id", pattern_cluster_id)
        .execute()
    )

    if result.data:
        return {"status": "unresolved"}
    return {"status": "not_found"}


async def get_resolved_patterns(project_id: str) -> list[str]:
    """
    Get all resolved pattern labels for a project.
    Injected into synthesis prompt so the agent doesn't resurface them.
    """
    db = get_supabase_admin()

    # Get all sessions for this project
    sessions = (
        db.table("sessions")
        .select("id")
        .eq("project_id", project_id)
        .execute()
    )

    if not sessions.data:
        return []

    session_ids = [s["id"] for s in sessions.data]

    # Get resolved patterns across all sessions
    patterns = (
        db.table("pattern_clusters")
        .select("label, pain_summary, resolved_at")
        .in_("session_id", session_ids)
        .eq("resolved", True)
        .execute()
    )

    return [
        p.get("label") or p.get("pain_summary") or ""
        for p in (patterns.data or [])
        if p.get("label") or p.get("pain_summary")
    ]


async def auto_archive_old_sessions(project_id: str | None = None) -> dict:
    """
    Auto-archive completed sessions older than AUTO_ARCHIVE_DAYS.
    Called by the scheduled worker.
    """
    db = get_supabase_admin()

    cutoff = (datetime.now(UTC) - timedelta(days=AUTO_ARCHIVE_DAYS)).isoformat()

    query = (
        db.table("sessions")
        .update({"archived_at": datetime.now(UTC).isoformat()})
        .eq("status", "completed")
        .is_("archived_at", "null")
        .lt("created_at", cutoff)
    )

    if project_id:
        query = query.eq("project_id", project_id)

    result = query.execute()
    archived = len(result.data or [])

    if archived > 0:
        logger.info("auto_archive_complete", archived=archived)

    return {"archived": archived}
