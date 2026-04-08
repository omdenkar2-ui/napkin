"""
Napkin — Ask Napkin API Routes
RAG chat over user's product history: sessions, patterns, specs, decisions.
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

router = APIRouter(prefix="/chat", tags=["chat"])


# ── Request / Response Models ────────────────────────────────────────

class ChatMessageRequest(BaseModel):
    project_id: UUID
    message: str
    session_id: UUID | None = None


class DataSummary(BaseModel):
    sessions_searched: int = 0
    feedback_items_searched: int = 0
    specs_found: int = 0
    decisions_found: int = 0


class ChatMessageResponse(BaseModel):
    role: str
    content: str
    metadata: dict
    data_summary: DataSummary | None = None


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


# ── Send message (Ask Napkin) ───────────────────────────────────────

@router.post("", response_model=ChatMessageResponse)
async def send_chat_message(
    body: ChatMessageRequest,
    user: Annotated[dict, Depends(get_current_user)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
):
    """Send a question to Napkin's RAG assistant. Returns a grounded answer."""
    _verify_project_access(body.project_id, user)

    from app.services.chat.engine import chat

    try:
        result = await chat(
            project_id=str(body.project_id),
            user_id=str(user_id),
            message=body.message,
            session_id=str(body.session_id) if body.session_id else None,
        )

        data_summary = None
        meta = result.get("metadata", {})
        if meta.get("data_summary"):
            data_summary = DataSummary(**meta["data_summary"])

        return ChatMessageResponse(
            role="assistant",
            content=result.get("content", ""),
            metadata=meta,
            data_summary=data_summary,
        )
    except Exception as e:
        logger.error("chat_message_failed", project_id=str(body.project_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process chat message",
        ) from e


# ── Get history ──────────────────────────────────────────────────────

@router.get("/history", response_model=list[dict])
async def get_chat_history(
    project_id: UUID = Query(...),
    limit: int = Query(default=50, ge=1, le=200),
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """Get chat history for a project."""
    _verify_project_access(project_id, user)

    from app.services.chat.engine import get_chat_history

    try:
        messages = await get_chat_history(
            project_id=str(project_id),
            limit=limit,
        )
        return messages
    except Exception as e:
        logger.error("chat_history_failed", project_id=str(project_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve chat history",
        ) from e
