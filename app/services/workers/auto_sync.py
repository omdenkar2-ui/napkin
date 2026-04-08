"""
Auto Sync Worker — Syncs all connected feedback sources on schedule.
Runs every 6 hours. Handles Gmail, GitHub Issues, and Intercom.
WhatsApp is webhook-based and doesn't need scheduled sync.
"""

from __future__ import annotations

import structlog

from app.db.client import get_supabase_admin

logger = structlog.get_logger(__name__)


async def sync_all_sources() -> list[dict]:
    """Sync all active integrations across all projects."""
    db = get_supabase_admin()
    results: list[dict] = []

    try:
        # Get all active integrations (not feedback_sources — integrations has tokens)
        integrations = (
            db.table("integrations")
            .select("id, project_id, provider, status, config")
            .in_("status", ["connected", "active"])
            .execute()
        )

        if not integrations.data:
            logger.debug("auto_sync_no_integrations")
            return results

        for integration in integrations.data:
            provider = integration.get("provider", "")
            project_id = integration.get("project_id", "")

            try:
                result = await _sync_one(provider, project_id)
                if result:
                    results.append({
                        "provider": provider,
                        "project_id": project_id,
                        **result,
                    })
            except Exception as exc:
                logger.error("auto_sync_source_failed",
                             provider=provider, project_id=project_id, error=str(exc))
                results.append({
                    "provider": provider,
                    "project_id": project_id,
                    "error": str(exc),
                })

        logger.info("auto_sync_complete", sources_synced=len(results))

    except Exception as exc:
        logger.error("auto_sync_failed", error=str(exc))

    return results


async def _sync_one(provider: str, project_id: str) -> dict | None:
    """Sync a single integration by provider type."""

    if provider == "gmail":
        from app.services.scrapers.gmail_scraper import sync_gmail_feedback
        result = await sync_gmail_feedback(project_id)
        logger.info("auto_sync_gmail", project_id=project_id,
                     synced=result.get("synced", 0))
        return result

    if provider == "github":
        # Sync both repo context AND issues
        from app.services.github.connector import sync_repo_context
        from app.services.scrapers.github_issues_scraper import sync_github_issues

        repo_result = await sync_repo_context(project_id)
        issues_result = await sync_github_issues(project_id)
        logger.info("auto_sync_github", project_id=project_id,
                     issues_synced=issues_result.get("items_synced", 0))
        return {
            "repo_context_updated": bool(repo_result),
            **issues_result,
        }

    if provider == "intercom":
        from app.services.scrapers.support_chat_scraper import sync_intercom
        result = await sync_intercom(project_id)
        logger.info("auto_sync_intercom", project_id=project_id,
                     synced=result.get("items_synced", 0))
        return result

    # WhatsApp is webhook-based — no scheduled sync needed
    if provider == "whatsapp":
        return None

    # Website scraper doesn't need periodic sync (on-demand only)
    if provider == "website":
        return None

    logger.debug("auto_sync_unknown_provider", provider=provider)
    return None
