"""
Napkin — Session API Routes
The core endpoints for running Napkin sessions.
"""

import csv
import io
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from app.api.deps.auth import get_current_user, get_current_user_id
from app.db.client import get_supabase_admin
from app.schemas.api import (
    FeedbackPaste,
    SessionCreate,
    SessionMessage,
    SessionMessageResponse,
)
import structlog

from app.services.session_service import get_session_service

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/sessions", tags=["sessions"])


class RepoFilesUpload(BaseModel):
    files: dict[str, str] = Field(max_length=500)  # max 500 files

    @field_validator("files")
    @classmethod
    def check_total_size(cls, v):
        total = sum(len(c) for c in v.values())
        if total > 10 * 1024 * 1024:  # 10 MB total
            raise ValueError("Payload too large: max 10MB of file content")
        return v


def _verify_session_access(db, session_id: UUID, user: dict) -> dict:
    """Verify user's org owns the session's project. Returns the session."""
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


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_session(
    body: SessionCreate,
    user: Annotated[dict, Depends(get_current_user)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
):
    """Start a new Napkin session."""
    # Verify project access
    db = get_supabase_admin()
    proj = db.table("projects").select("org_id").eq("id", str(body.project_id)).single().execute()
    if not proj.data:
        raise HTTPException(status_code=404, detail="Project not found")
    if proj.data.get("org_id") != user.get("org_id"):
        raise HTTPException(status_code=403, detail="Access denied")

    service = get_session_service()

    initial_texts = None
    if body.initial_feedback:
        initial_texts = body.initial_feedback.texts

    return await service.create_session(
        project_id=body.project_id,
        user_id=user_id,
        title=body.title,
        initial_feedback=initial_texts,
    )


@router.post("/{session_id}/message", response_model=SessionMessageResponse)
async def send_message(
    session_id: UUID,
    body: SessionMessage,
    user: Annotated[dict, Depends(get_current_user)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
):
    """Send a message to an active session."""
    db = get_supabase_admin()
    _verify_session_access(db, session_id, user)

    service = get_session_service()

    try:
        result = await service.process_message(
            session_id=session_id,
            user_id=user_id,
            content=body.content,
        )

        return SessionMessageResponse(
            session_id=session_id,
            stage=result["stage"],
            agent_message=result["agent_message"],
            questions=result.get("questions", []),
            gate_results=result.get("gate_results"),
            is_complete=result.get("is_complete", False),
            spec_ready=result.get("spec_ready", False),
            artifacts=result.get("artifacts", {}),
        )
    except ValueError as e:
        logger.error("session_message_failed", session_id=str(session_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An internal error occurred",
        ) from e


@router.post("/{session_id}/feedback", response_model=SessionMessageResponse)
async def add_feedback(
    session_id: UUID,
    body: FeedbackPaste,
    user: Annotated[dict, Depends(get_current_user)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
):
    """Add more feedback to a session."""
    db = get_supabase_admin()
    _verify_session_access(db, session_id, user)

    service = get_session_service()

    result = await service.process_message(
        session_id=session_id,
        user_id=user_id,
        raw_texts=body.texts,
    )

    return SessionMessageResponse(
        session_id=session_id,
        stage=result["stage"],
        agent_message=result["agent_message"],
        questions=result.get("questions", []),
        gate_results=result.get("gate_results"),
        is_complete=result.get("is_complete", False),
        spec_ready=result.get("spec_ready", False),
        artifacts=result.get("artifacts", {}),
    )


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: UUID,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Delete a session permanently."""
    db = get_supabase_admin()
    _verify_session_access(db, session_id, user)

    service = get_session_service()
    await service.delete_session(session_id)


@router.get("/{session_id}", response_model=dict)
async def get_session(
    session_id: UUID,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Get full session details including all agent outputs."""
    db = get_supabase_admin()
    _verify_session_access(db, session_id, user)

    service = get_session_service()
    session = await service.get_session(session_id)

    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    return session


@router.get("/{session_id}/spec", response_model=dict)
async def get_session_spec(
    session_id: UUID,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Get the generated spec from a session."""
    db = get_supabase_admin()
    _verify_session_access(db, session_id, user)

    service = get_session_service()
    spec = await service.get_session_spec(session_id)

    if not spec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No spec generated for this session yet",
        )

    return spec


@router.get("/{session_id}/cursor-prompt", response_model=dict)
async def get_cursor_prompt(
    session_id: UUID,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Get the Cursor-ready prompt from a completed session."""
    db = get_supabase_admin()
    _verify_session_access(db, session_id, user)

    service = get_session_service()
    prompt = await service.get_cursor_prompt(session_id)

    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Cursor prompt generated yet",
        )

    return {
        "session_id": str(session_id),
        "prompt": prompt,
    }


@router.get("/{session_id}/sprint-plan", response_model=dict)
async def get_sprint_plan(
    session_id: UUID,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Get the generated sprint plan from a session."""
    db = get_supabase_admin()
    _verify_session_access(db, session_id, user)

    service = get_session_service()
    plan = await service.get_sprint_plan(session_id)

    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No sprint plan generated for this session yet",
        )

    return {"session_id": str(session_id), "sprint_plan": plan}


@router.get("/{session_id}/prioritization", response_model=dict)
async def get_prioritization(
    session_id: UUID,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Get the opportunity prioritization results from a session."""
    db = get_supabase_admin()
    _verify_session_access(db, session_id, user)

    service = get_session_service()
    result = await service.get_prioritization(session_id)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No prioritization results for this session yet",
        )

    return {"session_id": str(session_id), "prioritization": result}


@router.post("/{session_id}/repo-files", response_model=dict)
async def upload_repo_files(
    session_id: UUID,
    body: RepoFilesUpload,
    user: Annotated[dict, Depends(get_current_user)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
):
    """Upload repo file contents for deep context analysis.

    Body: {"files": {"path/to/file.py": "content...", ...}}
    """
    db = get_supabase_admin()
    _verify_session_access(db, session_id, user)

    service = get_session_service()
    await service.set_repo_files(session_id, body.files)

    return {
        "session_id": str(session_id),
        "files_received": len(body.files),
        "message": "Repo files attached. They will be analyzed during the repo_context stage.",
    }


@router.get("/{session_id}/exports", response_model=dict)
async def get_exports(
    session_id: UUID,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Get all export artifacts for a completed session."""
    db = get_supabase_admin()
    _verify_session_access(db, session_id, user)

    service = get_session_service()
    session = await service.get_session(session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    exports = (session.get("gate_results") or {}).get("exports")
    if not exports:
        raise HTTPException(
            status_code=404,
            detail="Exports not ready. Pipeline may still be running.",
        )

    return exports


@router.get("/{session_id}/exports/tickets")
async def get_export_tickets(
    session_id: UUID,
    request: Request,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Get exported tickets as JSON or CSV."""
    db = get_supabase_admin()
    _verify_session_access(db, session_id, user)

    service = get_session_service()
    session = await service.get_session(session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    tickets = ((session.get("gate_results") or {}).get("exports") or {}).get("tickets", [])
    if not tickets:
        raise HTTPException(status_code=404, detail="No tickets available")

    accept = request.headers.get("accept", "")
    if "text/csv" in accept:
        output = io.StringIO()
        writer = csv.DictWriter(
            output,
            fieldnames=[
                "title", "priority", "effort_estimate",
                "source_feedback_count", "rice_score",
            ],
            extrasaction="ignore",
        )
        writer.writeheader()
        writer.writerows(tickets)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=tickets.csv"},
        )

    return tickets


@router.get("/{session_id}/exports/prd", response_model=dict)
async def get_export_prd(
    session_id: UUID,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Get the PRD download URL."""
    db = get_supabase_admin()
    _verify_session_access(db, session_id, user)

    service = get_session_service()
    session = await service.get_session(session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    prd_url = ((session.get("gate_results") or {}).get("exports") or {}).get("prd_url")
    if prd_url:
        return {"prd_url": prd_url, "expires_in": "24 hours"}

    raise HTTPException(
        status_code=503,
        detail="PDF generation failed or Supabase storage unavailable.",
    )


@router.get("", response_model=list[dict])
async def list_sessions(
    project_id: UUID,
    user: Annotated[dict, Depends(get_current_user)],
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """List sessions for a project."""
    # Verify project access
    db = get_supabase_admin()
    proj = db.table("projects").select("org_id").eq("id", str(project_id)).single().execute()
    if not proj.data or proj.data.get("org_id") != user.get("org_id"):
        raise HTTPException(status_code=403, detail="Access denied")

    service = get_session_service()
    return await service.list_sessions(project_id, limit=limit, offset=offset)
