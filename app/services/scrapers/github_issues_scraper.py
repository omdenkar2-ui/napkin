"""
Napkin — GitHub Issues Scraper
Pulls issues and discussions from the user's connected GitHub repo,
classifies which are user feedback, and writes to feedback_items.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import httpx
import structlog

from app.db.client import get_supabase_admin

logger = structlog.get_logger(__name__)

# Labels that strongly indicate user feedback
FEEDBACK_LABELS = frozenset({
    "bug", "feature request", "feature", "enhancement", "question",
    "feedback", "user-reported", "ux", "usability", "help wanted",
    "support", "documentation", "confusion",
})

# Labels that indicate internal dev work — skip these
INTERNAL_LABELS = frozenset({
    "ci", "ci/cd", "refactor", "tech-debt", "internal", "dependencies",
    "chore", "release", "test", "infrastructure", "wontfix", "duplicate",
})

# Keywords in title/body that suggest user-facing feedback
FEEDBACK_KEYWORDS = [
    "user", "customer", "bug", "broken", "doesn't work", "can't",
    "confused", "expected", "should", "please", "feature", "request",
    "would be great", "wish", "frustrating", "annoying", "slow",
    "crash", "error", "fail",
]

GITHUB_API = "https://api.github.com"


async def sync_github_issues(project_id: str) -> dict:
    """
    Pull recent issues from the connected GitHub repo,
    filter to user feedback, and write to feedback_items.
    """
    db = get_supabase_admin()
    log = logger.bind(project_id=project_id)

    # 1. Get GitHub integration (reuse repo connector's token)
    integration = (
        db.table("integrations")
        .select("*")
        .eq("project_id", project_id)
        .eq("provider", "github")
        .limit(1)
        .execute()
    )
    if not integration.data:
        log.warning("github_issues_no_integration")
        return {"items_synced": 0, "error": "No GitHub integration found"}

    config = integration.data[0].get("config") or {}
    access_token = integration.data[0].get("access_token") or ""
    repo_owner = config.get("repo_owner", "")
    repo_name = config.get("repo_name", "")

    if not access_token or not repo_owner or not repo_name:
        log.warning("github_issues_missing_config")
        return {"items_synced": 0, "error": "GitHub repo not fully configured"}

    # 2. Fetch issues (last 30 days)
    since = (datetime.now(UTC) - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
    issues = await _fetch_issues(access_token, repo_owner, repo_name, since)
    log.info("github_issues_fetched", count=len(issues))

    # 3. Filter to user feedback
    feedback_issues = _filter_feedback(issues)
    log.info("github_issues_filtered", feedback=len(feedback_issues), total=len(issues))

    # 4. Write to feedback_items (batch dedup + batch insert)
    source_id = _ensure_source(db, project_id, repo_owner, repo_name)
    items_synced = 0

    # Build candidate external_ids for batch dedup
    candidates = []
    for issue in feedback_issues:
        ext_id = f"gh_issue:{repo_owner}/{repo_name}#{issue['number']}"
        raw_text = _build_feedback_text(issue)
        if len(raw_text.strip()) < 10:
            continue
        candidates.append((ext_id, issue, raw_text))

    if not candidates:
        _update_sync_metadata(db, integration.data[0]["id"], 0)
        return {"items_synced": 0, "issues_scanned": len(issues), "feedback_found": len(feedback_issues)}

    # Batch dedup: fetch all existing external_ids in one query
    candidate_ids = [c[0] for c in candidates]
    try:
        existing = (
            db.table("feedback_items")
            .select("external_id")
            .eq("project_id", project_id)
            .in_("external_id", candidate_ids)
            .execute()
        )
        existing_ids = {r["external_id"] for r in (existing.data or [])}
    except Exception:
        existing_ids = set()

    # Build batch of new items
    new_rows = []
    for ext_id, issue, raw_text in candidates:
        if ext_id in existing_ids:
            continue
        new_rows.append({
            "id": str(uuid4()),
            "project_id": project_id,
            "source_id": source_id,
            "external_id": ext_id,
            "raw_text": raw_text,
            "status": "raw",
            "metadata": {
                "issue_number": issue["number"],
                "title": issue["title"],
                "labels": [la["name"] for la in issue.get("labels", [])],
                "state": issue["state"],
                "comments_count": issue.get("comments", 0),
                "created_at": issue["created_at"],
                "url": issue["html_url"],
                "repo": f"{repo_owner}/{repo_name}",
                "author": issue.get("user", {}).get("login", "unknown"),
            },
        })

    # Batch insert
    if new_rows:
        try:
            db.table("feedback_items").insert(new_rows).execute()
            items_synced = len(new_rows)
        except Exception as exc:
            log.warning("github_issues_batch_insert_failed", error=str(exc), count=len(new_rows))
            # Fallback: insert one by one
            for row in new_rows:
                try:
                    db.table("feedback_items").insert(row).execute()
                    items_synced += 1
                except Exception:
                    pass

    # 5. Update sync metadata
    _update_sync_metadata(db, integration.data[0]["id"], items_synced)

    log.info("github_issues_sync_complete",
             issues_scanned=len(issues),
             feedback_found=len(feedback_issues),
             items_synced=items_synced)

    return {
        "items_synced": items_synced,
        "issues_scanned": len(issues),
        "feedback_found": len(feedback_issues),
    }


# ===================================================================
# GitHub API
# ===================================================================

async def _fetch_issues(
    token: str, owner: str, repo: str, since: str, max_results: int = 100,
) -> list[dict]:
    """Fetch issues from GitHub REST API. Filters out PRs."""
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
    }
    issues: list[dict] = []
    page = 1

    async with httpx.AsyncClient(timeout=30) as client:
        while len(issues) < max_results:
            resp = await client.get(
                f"{GITHUB_API}/repos/{owner}/{repo}/issues",
                headers=headers,
                params={
                    "state": "all",
                    "since": since,
                    "per_page": min(100, max_results - len(issues)),
                    "page": page,
                    "sort": "created",
                    "direction": "desc",
                },
            )
            if resp.status_code != 200:
                logger.warning("github_issues_api_error", status=resp.status_code)
                break

            batch = resp.json()
            if not batch:
                break

            # GitHub API returns PRs mixed with issues — filter them out
            real_issues = [i for i in batch if "pull_request" not in i]
            issues.extend(real_issues)

            if len(batch) < 100:
                break
            page += 1

        # Fetch top 3 comments for richer context (top 50 issues only)
        for issue in issues[:50]:
            if issue.get("comments", 0) > 0:
                try:
                    resp = await client.get(
                        issue["comments_url"],
                        headers=headers,
                        params={"per_page": 3},
                    )
                    if resp.status_code == 200:
                        issue["_comments"] = resp.json()
                except Exception:
                    issue["_comments"] = []

    return issues


# ===================================================================
# Filtering
# ===================================================================

def _filter_feedback(issues: list[dict]) -> list[dict]:
    """Filter issues to those likely containing user feedback."""
    feedback = []
    for issue in issues:
        labels = {la["name"].lower() for la in issue.get("labels", [])}

        # Skip if clearly internal
        if labels & INTERNAL_LABELS:
            continue

        # Include if has feedback-like labels
        if labels & FEEDBACK_LABELS:
            feedback.append(issue)
            continue

        # Include if body/title mentions user-facing concerns
        text = f"{issue.get('title', '')} {issue.get('body') or ''}".lower()
        if any(kw in text for kw in FEEDBACK_KEYWORDS):
            feedback.append(issue)

    return feedback


# ===================================================================
# Text Building
# ===================================================================

def _build_feedback_text(issue: dict) -> str:
    """Build rich feedback text from issue + comments."""
    parts = [f"[GitHub Issue #{issue['number']}] {issue['title']}"]

    if issue.get("body"):
        parts.append(issue["body"][:3000])

    for comment in issue.get("_comments", [])[:3]:
        commenter = comment.get("user", {}).get("login", "unknown")
        parts.append(f"[Comment by {commenter}]: {comment.get('body', '')[:1000]}")

    labels = [la["name"] for la in issue.get("labels", [])]
    if labels:
        parts.append(f"Labels: {', '.join(labels)}")

    return "\n\n".join(parts)


# ===================================================================
# Helpers
# ===================================================================

def _ensure_source(db, project_id: str, repo_owner: str, repo_name: str) -> str:
    """Get or create a feedback_source for GitHub Issues."""
    existing = (
        db.table("feedback_sources")
        .select("id")
        .eq("project_id", project_id)
        .eq("source_type", "github_issues")
        .limit(1)
        .execute()
    )
    if existing.data:
        return existing.data[0]["id"]

    source_id = str(uuid4())
    db.table("feedback_sources").insert({
        "id": source_id,
        "project_id": project_id,
        "source_type": "api",  # "github_issues" not in CHECK constraint, use "api"
        "config": {"repo_owner": repo_owner, "repo_name": repo_name},
        "is_active": True,
    }).execute()
    return source_id


def _update_sync_metadata(db, integration_id: str, synced_count: int) -> None:
    """Update last_synced_at on the integration record."""
    db.table("integrations").update({
        "last_synced_at": datetime.now(UTC).isoformat(),
        "last_error": None,
    }).eq("id", integration_id).execute()
