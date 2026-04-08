"""
GitHub Issue Checker — Polls GitHub for closed issues that Napkin created.
Auto-marks decisions as shipped and patterns as resolved.
Runs every 12 hours via APScheduler.
"""

from __future__ import annotations

from datetime import UTC, datetime

import httpx
import structlog

from app.db.client import get_supabase_admin

logger = structlog.get_logger(__name__)


async def check_github_issues() -> dict:
    """
    Check all open GitHub issues tracked in decision_log.
    If an issue was closed on GitHub, mark the decision as shipped
    and the associated pattern as resolved.
    """
    db = get_supabase_admin()

    # 1. Get all decisions with open GitHub issues
    try:
        open_decisions = (
            db.table("decision_log")
            .select("id, project_id, spec_id, pattern_cluster_id, github_issue_number, github_issue_url")
            .eq("github_issue_state", "open")
            .not_.is_("github_issue_number", "null")
            .execute()
        )
    except Exception as exc:
        logger.error("github_checker_query_failed", error=str(exc))
        return {"checked": 0, "shipped": 0}

    if not open_decisions.data:
        logger.debug("github_checker_no_open_issues")
        return {"checked": 0, "shipped": 0}

    # 2. Group by project to minimize token lookups
    by_project: dict[str, list[dict]] = {}
    for d in open_decisions.data:
        by_project.setdefault(d["project_id"], []).append(d)

    checked = 0
    shipped = 0

    for project_id, decisions in by_project.items():
        token = _get_github_token(db, project_id)
        if not token:
            logger.warning("github_checker_no_token", project_id=project_id)
            continue

        repo_info = _get_repo_info(db, project_id)
        if not repo_info:
            logger.warning("github_checker_no_repo", project_id=project_id)
            continue

        owner, repo = repo_info

        async with httpx.AsyncClient(timeout=15) as client:
            for decision in decisions:
                issue_number = decision["github_issue_number"]
                checked += 1

                try:
                    resp = await client.get(
                        f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}",
                        headers={
                            "Authorization": f"Bearer {token}",
                            "Accept": "application/vnd.github.v3+json",
                        },
                    )

                    if resp.status_code != 200:
                        logger.debug("github_checker_api_error",
                                      issue=issue_number, status=resp.status_code)
                        continue

                    issue_data = resp.json()

                    if issue_data.get("state") == "closed":
                        await _mark_shipped(db, decision)
                        shipped += 1
                        logger.info("github_issue_shipped",
                                     issue=issue_number, decision_id=decision["id"])

                except Exception as exc:
                    logger.warning("github_checker_issue_failed",
                                    issue=issue_number, error=str(exc))

    logger.info("github_checker_complete", checked=checked, shipped=shipped)
    return {"checked": checked, "shipped": shipped}


async def _mark_shipped(db, decision: dict) -> None:
    """Mark a decision as shipped and its linked pattern as resolved."""
    now = datetime.now(UTC).isoformat()

    # Update decision_log
    db.table("decision_log").update({
        "outcome_status": "shipped",
        "github_issue_state": "closed",
        "shipped_at": now,
        "auto_shipped": True,
        "outcome_date": now,
        "outcome_notes": "Auto-detected: GitHub issue was closed.",
    }).eq("id", decision["id"]).execute()

    # Resolve the associated pattern (if linked)
    pattern_id = decision.get("pattern_cluster_id")
    spec_id = decision.get("spec_id")
    if pattern_id:
        try:
            from app.services.session_lifecycle import resolve_pattern
            await resolve_pattern(pattern_id, spec_id or "")
        except Exception as exc:
            logger.warning("github_checker_resolve_failed",
                            pattern_id=pattern_id, error=str(exc))


def _get_github_token(db, project_id: str) -> str | None:
    """Get GitHub access token for a project from integrations table."""
    try:
        result = (
            db.table("integrations")
            .select("access_token")
            .eq("project_id", project_id)
            .eq("provider", "github")
            .limit(1)
            .execute()
        )
        if result.data and result.data[0].get("access_token"):
            return result.data[0]["access_token"]
    except Exception:
        pass
    return None


def _get_repo_info(db, project_id: str) -> tuple[str, str] | None:
    """Get owner/repo from the GitHub integration config."""
    try:
        result = (
            db.table("integrations")
            .select("config")
            .eq("project_id", project_id)
            .eq("provider", "github")
            .limit(1)
            .execute()
        )
        if result.data:
            config = result.data[0].get("config") or {}
            owner = config.get("repo_owner", "")
            repo = config.get("repo_name", "")
            if owner and repo:
                return owner, repo
    except Exception:
        pass
    return None
