"""
Napkin — Weekly Brief API Routes
Generate and retrieve weekly digests.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.api.deps.auth import get_current_user
from app.db.client import get_supabase_admin
import structlog

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/briefs", tags=["briefs"])


# ── Helpers ──────────────────────────────────────────────────────────

def _verify_project_access(project_id: UUID, user: dict) -> None:
    db = get_supabase_admin()
    proj = (
        db.table("projects")
        .select("org_id")
        .eq("id", str(project_id))
        .single()
        .execute()
    )
    if not proj.data:
        raise HTTPException(status_code=404, detail="Project not found")
    if proj.data.get("org_id") != user.get("org_id"):
        raise HTTPException(status_code=403, detail="Access denied")


# ── Generate weekly brief ────────────────────────────────────────────

@router.post("/weekly/{project_id}", response_model=dict)
async def generate_brief(
    project_id: UUID,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Generate the weekly brief for a project (on-demand)."""
    _verify_project_access(project_id, user)

    from app.services.briefs.weekly_brief import generate_weekly_brief

    brief = await generate_weekly_brief(str(project_id))
    return brief


# ── Get Slack-formatted brief ────────────────────────────────────────

@router.get("/weekly/{project_id}/slack", response_model=dict)
async def get_brief_slack(
    project_id: UUID,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Get the weekly brief formatted for Slack."""
    _verify_project_access(project_id, user)

    from app.services.briefs.weekly_brief import generate_weekly_brief, format_brief_for_slack

    brief = await generate_weekly_brief(str(project_id))
    slack_msg = await format_brief_for_slack(brief)
    return {"message": slack_msg, "brief": brief}


# ── List past briefs ─────────────────────────────────────────────────

@router.get("/history/{project_id}", response_model=list[dict])
async def list_briefs(
    project_id: UUID,
    user: Annotated[dict, Depends(get_current_user)],
    limit: int = Query(default=10, ge=1, le=50),
):
    """List past weekly briefs for a project."""
    _verify_project_access(project_id, user)

    db = get_supabase_admin()
    result = (
        db.table("napkin_artifacts")
        .select("id, title, summary, render_data, created_at")
        .eq("project_id", str(project_id))
        .eq("milestone_type", "custom")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )

    return [
        {
            "id": a["id"],
            "title": a.get("title", ""),
            "summary": a.get("summary", ""),
            "brief": a.get("render_data", {}),
            "created_at": a.get("created_at", ""),
        }
        for a in (result.data or [])
        if a.get("render_data", {}).get("top_patterns") is not None  # filter to actual briefs
    ]
