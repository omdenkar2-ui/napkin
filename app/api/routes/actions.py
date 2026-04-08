"""
Napkin — Action API Routes
Generate, list, and send actions derived from session insights.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.api.deps.auth import get_current_user, get_current_user_id
from app.db.client import get_supabase_admin
import structlog

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/actions", tags=["actions"])


# ── Request / Response Models ────────────────────────────────────────

class GenerateActionsRequest(BaseModel):
    session_id: UUID
    project_id: UUID


class SendActionRequest(BaseModel):
    project_id: UUID


# ── Helpers ──────────────────────────────────────────────────────────

def _verify_project_access(project_id: UUID, user: dict) -> None:
    """Verify the authenticated user's org owns the project."""
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


def _verify_session_access(session_id: UUID, user: dict) -> dict:
    """Verify user's org owns the session's project. Returns the session."""
    db = get_supabase_admin()
    result = (
        db.table("sessions")
        .select("*, projects!inner(org_id)")
        .eq("id", str(session_id))
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")
    project = result.data.get("projects", {})
    if project.get("org_id") != user.get("org_id"):
        raise HTTPException(status_code=403, detail="Access denied")
    return result.data


# ── Generate actions ─────────────────────────────────────────────────

@router.post("/generate", response_model=list[dict])
async def generate_actions(
    body: GenerateActionsRequest,
    user: Annotated[dict, Depends(get_current_user)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
):
    """Generate all action types for a session."""
    _verify_project_access(body.project_id, user)
    _verify_session_access(body.session_id, user)

    from app.services.actions.generator import generate_actions_for_session

    try:
        actions = await generate_actions_for_session(
            session_id=body.session_id,
            project_id=body.project_id,
            user_id=user_id,
        )
        return actions
    except Exception as e:
        logger.error(
            "action_generation_failed",
            session_id=str(body.session_id),
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate actions",
        ) from e


# ── List actions ─────────────────────────────────────────────────────

@router.get("", response_model=list[dict])
async def list_actions(
    session_id: UUID = Query(...),
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """List all generated actions for a session."""
    _verify_session_access(session_id, user)

    db = get_supabase_admin()
    result = (
        db.table("generated_actions")
        .select("*")
        .eq("session_id", str(session_id))
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


# ── Send a specific action ───────────────────────────────────────────

@router.post("/{action_id}/send", response_model=dict)
async def send_action(
    action_id: UUID,
    body: SendActionRequest,
    user: Annotated[dict, Depends(get_current_user)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
):
    """Send a generated action to its destination (GitHub issue, Slack, etc.)."""
    _verify_project_access(body.project_id, user)

    db = get_supabase_admin()
    action_result = (
        db.table("generated_actions")
        .select("*")
        .eq("id", str(action_id))
        .single()
        .execute()
    )
    if not action_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Action not found",
        )

    action = action_result.data
    action_type = action.get("action_type", "")

    try:
        if action_type == "github_issue":
            from app.services.actions.generator import send_github_issue

            result = await send_github_issue(
                action_id=str(action_id),
                project_id=str(body.project_id),
            )
        elif action_type == "slack_message":
            from app.services.actions.generator import send_slack_message

            result = await send_slack_message(
                action_id=str(action_id),
                project_id=str(body.project_id),
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported action type: {action_type}",
            )

        return {
            "status": "sent",
            "external_url": result.get("external_url") or result.get("url"),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "action_send_failed",
            action_id=str(action_id),
            action_type=action_type,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send action",
        ) from e


# ── Check shipped GitHub issues ─────────────────────────────────────

@router.post("/check-shipped", response_model=dict)
async def check_shipped(
    user: Annotated[dict, Depends(get_current_user)],
):
    """Manually trigger GitHub issue check. Auto-marks shipped decisions."""
    from app.services.workers.github_checker import check_github_issues

    result = await check_github_issues()
    return result
