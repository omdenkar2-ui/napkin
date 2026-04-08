"""
Weekly Worker — Generates weekly briefs for all active projects.
Scheduled every Monday at 8am UTC.
"""

from __future__ import annotations

import structlog

from app.db.client import get_supabase_admin

logger = structlog.get_logger(__name__)


async def generate_all_briefs() -> list[dict]:
    """Generate weekly briefs for every project that had activity this week."""
    from app.services.briefs.weekly_brief import generate_weekly_brief

    db = get_supabase_admin()
    results: list[dict] = []

    try:
        projects = db.table("projects").select("id, name").execute()
        if not projects.data:
            return results

        for project in projects.data:
            try:
                brief = await generate_weekly_brief(project["id"])
                results.append({
                    "project": project["name"],
                    "subject": brief.get("subject", ""),
                    "patterns": len(brief.get("top_patterns", [])),
                })
                logger.info("weekly_brief_generated", project=project["name"])
            except Exception as exc:
                logger.error("weekly_brief_failed", project=project["name"], error=str(exc))
                results.append({"project": project["name"], "error": str(exc)})

    except Exception as exc:
        logger.error("weekly_worker_failed", error=str(exc))

    logger.info("weekly_worker_complete", projects=len(results))
    return results
