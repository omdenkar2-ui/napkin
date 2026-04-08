"""
Napkin — Specs & Artifacts Routes
Manage generated specs and shareable napkin artifacts.
"""

from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.api.deps.auth import get_current_user, get_current_user_id
from app.db.client import get_supabase_admin
from app.schemas.api import SpecOutcomeUpdate, SpecStatusUpdate

# ============================================================
# SPECS
# ============================================================

specs_router = APIRouter(prefix="/specs", tags=["specs"])


def _verify_spec_access(db, spec_id: UUID, user: dict) -> dict:
    """Verify user's org owns the spec's project. Returns the spec."""
    result = (
        db.table("specs")
        .select("*, projects!inner(org_id)")
        .eq("id", str(spec_id))
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Spec not found")
    project = result.data.get("projects", {})
    if project.get("org_id") != user.get("org_id"):
        raise HTTPException(status_code=403, detail="Access denied")
    return result.data


class CreateSpecRequest(BaseModel):
    session_id: UUID


@specs_router.post("", response_model=dict)
async def create_spec(
    body: CreateSpecRequest,
    user: Annotated[dict, Depends(get_current_user)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
):
    """Save a session's spec_object to the specs table (creates a decision)."""
    db = get_supabase_admin()

    # Get session with access check
    session = (
        db.table("sessions")
        .select("id, project_id, spec_object, cursor_prompt, four_q_answers, ambiguity_score, projects!inner(org_id)")
        .eq("id", str(body.session_id))
        .single()
        .execute()
    )
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")
    project = session.data.get("projects", {})
    if project.get("org_id") != user.get("org_id"):
        raise HTTPException(status_code=403, detail="Access denied")

    spec_obj = session.data.get("spec_object")
    if not spec_obj:
        raise HTTPException(status_code=400, detail="Session has no spec to save")

    project_id = session.data["project_id"]

    # Check if spec already saved for this session
    existing = (
        db.table("specs")
        .select("id")
        .eq("session_id", str(body.session_id))
        .limit(1)
        .execute()
    )
    if existing.data:
        return existing.data[0]  # Already saved — return it

    spec_id = str(uuid4())
    row = {
        "id": spec_id,
        "session_id": str(body.session_id),
        "project_id": project_id,
        "created_by": str(user_id),
        "decision": spec_obj.get("decision", {}),
        "ui_changes": spec_obj.get("ui_changes"),
        "data_model": spec_obj.get("data_model"),
        "task_breakdown": spec_obj.get("task_breakdown"),
        "success_criteria": spec_obj.get("success_criteria"),
        "cursor_prompt": spec_obj.get("cursor_prompt") or session.data.get("cursor_prompt"),
        "ambiguity_score": spec_obj.get("ambiguity_score") or session.data.get("ambiguity_score"),
        "status": "draft",
    }
    result = db.table("specs").insert(row).execute()
    return result.data[0] if result.data else row


@specs_router.get("", response_model=list[dict])
async def list_specs(
    project_id: UUID,
    user: Annotated[dict, Depends(get_current_user)],
    status_filter: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
):
    """List specs for a project."""
    db = get_supabase_admin()
    # Verify project access
    proj = db.table("projects").select("org_id").eq("id", str(project_id)).single().execute()
    if not proj.data or proj.data.get("org_id") != user.get("org_id"):
        raise HTTPException(status_code=403, detail="Access denied")

    query = db.table("specs").select("*").eq("project_id", str(project_id))
    if status_filter:
        query = query.eq("status", status_filter)

    result = query.order("created_at", desc=True).limit(limit).execute()
    return result.data


@specs_router.get("/{spec_id}", response_model=dict)
async def get_spec(
    spec_id: UUID,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Get a specific spec with all sections."""
    db = get_supabase_admin()
    return _verify_spec_access(db, spec_id, user)


@specs_router.patch("/{spec_id}/status")
async def update_spec_status(
    spec_id: UUID,
    body: SpecStatusUpdate,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Update spec status (draft -> review -> approved -> shipped)."""
    db = get_supabase_admin()
    _verify_spec_access(db, spec_id, user)

    result = (
        db.table("specs")
        .update({"status": body.status.value})
        .eq("id", str(spec_id))
        .execute()
    )
    return result.data[0] if result.data else {}


@specs_router.patch("/{spec_id}/outcome")
async def record_spec_outcome(
    spec_id: UUID,
    body: SpecOutcomeUpdate,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Record the outcome of a shipped spec (did it work?)."""
    db = get_supabase_admin()
    _verify_spec_access(db, spec_id, user)

    outcome_data = {
        "shipped": body.shipped,
        "outcome_notes": body.outcome_notes,
        "success_metrics_met": body.success_metrics_met,
    }
    result = (
        db.table("specs")
        .update({"outcome": outcome_data, "status": "shipped" if body.shipped else "abandoned"})
        .eq("id", str(spec_id))
        .execute()
    )
    return result.data[0] if result.data else {}


# ============================================================
# NAPKIN ARTIFACTS (Virality Layer)
# ============================================================

artifacts_router = APIRouter(prefix="/artifacts", tags=["artifacts"])


@artifacts_router.get("/share/{share_token}", response_model=dict)
async def get_public_artifact(share_token: str):
    """Get a publicly shared napkin artifact (no auth required)."""
    db = get_supabase_admin()
    result = (
        db.table("napkin_artifacts")
        .select("*")
        .eq("share_token", share_token)
        .eq("is_public", True)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Artifact not found")

    # Atomic view count increment via RPC or raw update
    db.table("napkin_artifacts").update(
        {"view_count": result.data["view_count"] + 1}
    ).eq("id", result.data["id"]).execute()

    return result.data


@artifacts_router.get("", response_model=list[dict])
async def list_artifacts(
    project_id: UUID,
    user: Annotated[dict, Depends(get_current_user)],
    limit: int = Query(default=20, ge=1, le=100),
):
    """List artifacts for a project."""
    db = get_supabase_admin()
    # Verify project access
    proj = db.table("projects").select("org_id").eq("id", str(project_id)).single().execute()
    if not proj.data or proj.data.get("org_id") != user.get("org_id"):
        raise HTTPException(status_code=403, detail="Access denied")

    result = (
        db.table("napkin_artifacts")
        .select("*")
        .eq("project_id", str(project_id))
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data
