"""
Napkin Backend — API Request/Response Schemas
Thin DTOs for the REST API layer. Separate from domain models.
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.models.entities import (
    MemberRole,
    MilestoneType,
    OrgPlan,
    SessionStage,
    SessionStatus,
    SpecStatus,
)

# ============================================================
# AUTH
# ============================================================

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_token: str | None = None
    user: "ProfileResponse | None" = None


# ============================================================
# PROFILES
# ============================================================

class ProfileResponse(BaseModel):
    id: UUID
    email: str
    full_name: str | None
    avatar_url: str | None
    org_id: UUID | None
    role: MemberRole
    onboarding_done: bool
    created_at: datetime


class ProfileUpdate(BaseModel):
    full_name: str | None = None
    avatar_url: str | None = None
    preferences: dict[str, Any] | None = None


# ============================================================
# ORGANIZATIONS
# ============================================================

class OrgCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    slug: str = Field(min_length=2, max_length=50, pattern=r"^[a-z0-9-]+$")


class OrgResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    plan: OrgPlan
    created_at: datetime


class InviteMember(BaseModel):
    email: str
    role: MemberRole = MemberRole.MEMBER


# ============================================================
# PROJECTS
# ============================================================

class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    repo_url: str | None = None
    repo_provider: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    repo_url: str | None = None
    repo_provider: str | None = None
    settings: dict[str, Any] | None = None


class ProjectResponse(BaseModel):
    id: UUID
    org_id: UUID
    name: str
    description: str | None
    repo_url: str | None
    repo_provider: str | None
    created_at: datetime
    updated_at: datetime


# ============================================================
# FEEDBACK
# ============================================================

class FeedbackPaste(BaseModel):
    """Paste raw feedback text directly."""
    texts: list[str] = Field(min_length=1, max_length=100)
    source_label: str | None = None  # e.g. "intercom chat", "user interview"
    metadata: dict[str, Any] | None = None

    @field_validator("texts")
    @classmethod
    def validate_texts(cls, v):
        cleaned = [t.strip() for t in v if t.strip()]
        if not cleaned:
            raise ValueError("At least one non-empty text is required")
        return cleaned


class FeedbackUploadResponse(BaseModel):
    items_created: int
    items_skipped: int
    source_id: UUID | None
    session_id: UUID | None


class FeedbackItemResponse(BaseModel):
    id: UUID
    raw_text: str
    pain: str | None
    request: str | None
    emotion: str | None
    jtbd_hint: str | None
    segment_guess: str | None
    status: str
    created_at: datetime


class FeedbackListResponse(BaseModel):
    items: list[FeedbackItemResponse]
    total: int
    page: int
    page_size: int


# ============================================================
# SESSIONS
# ============================================================

class SessionCreate(BaseModel):
    project_id: UUID
    title: str | None = None
    initial_feedback: FeedbackPaste | None = None


class SessionResponse(BaseModel):
    id: UUID
    project_id: UUID
    stage: SessionStage
    status: SessionStatus
    title: str | None
    gate_results: dict[str, Any]
    ambiguity_score: float | None
    started_at: datetime
    completed_at: datetime | None
    duration_seconds: int | None
    created_at: datetime


class SessionDetailResponse(SessionResponse):
    intake_summary: dict[str, Any] | None
    four_q_answers: dict[str, Any] | None
    pattern_report: dict[str, Any] | None
    decision_object: dict[str, Any] | None
    spec_object: dict[str, Any] | None
    cursor_prompt: str | None
    task_plan: dict[str, Any] | None
    messages: list[dict[str, Any]]


class SessionMessage(BaseModel):
    """User sends a message during a session (answer to question, clarification, etc.)."""
    content: str = Field(min_length=1, max_length=5000)
    stage_hint: SessionStage | None = None  # optional: user can request stage jump


class SessionMessageResponse(BaseModel):
    """Agent response to user message."""
    session_id: UUID
    stage: SessionStage
    agent_message: str
    questions: list[str] = Field(default_factory=list)  # follow-up questions
    gate_results: dict[str, Any] | None = None
    is_complete: bool = False
    spec_ready: bool = False
    artifacts: dict[str, Any] = Field(default_factory=dict)  # any generated outputs


# ============================================================
# SPECS
# ============================================================

class SpecResponse(BaseModel):
    id: UUID
    session_id: UUID
    project_id: UUID
    version: int
    status: SpecStatus
    decision: dict[str, Any]
    ui_changes: dict[str, Any] | None
    data_model: dict[str, Any] | None
    task_breakdown: dict[str, Any] | None
    success_criteria: dict[str, Any] | None
    cursor_prompt: str | None
    ambiguity_score: float | None
    completeness: float | None
    grounding_score: float | None
    created_at: datetime


class SpecStatusUpdate(BaseModel):
    status: SpecStatus


class SpecOutcomeUpdate(BaseModel):
    shipped: bool
    outcome_notes: str | None = None
    success_metrics_met: dict[str, bool] | None = None


# ============================================================
# PATTERN REPORT
# ============================================================

class PatternReportResponse(BaseModel):
    session_id: UUID
    clusters: list[dict[str, Any]]
    top_pains: list[str]
    contradictions: list[dict[str, Any]]
    total_items_analyzed: int
    segments_found: list[str]
    generated_at: datetime


# ============================================================
# CURSOR PROMPT
# ============================================================

class CursorPromptResponse(BaseModel):
    session_id: UUID
    spec_id: UUID
    prompt: str
    grounding_score: float | None
    version: int
    generated_at: datetime


# ============================================================
# NAPKIN ARTIFACTS
# ============================================================

class ArtifactResponse(BaseModel):
    id: UUID
    title: str
    summary: str | None
    milestone_type: MilestoneType | None
    image_url: str | None
    share_token: str
    is_public: bool
    view_count: int
    created_at: datetime


# ============================================================
# HEALTH
# ============================================================

class HealthResponse(BaseModel):
    status: str = "ok"
    version: str
    environment: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
