"""
Napkin Backend — Database Entity Models
Pydantic models mirroring Supabase tables for type-safe DB operations.
"""

from datetime import UTC, datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

# ============================================================
# ENUMS
# ============================================================

class OrgPlan(StrEnum):
    FREE = "free"
    PRO = "pro"
    TEAM = "team"
    ENTERPRISE = "enterprise"

class MemberRole(StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"

class SessionStage(StrEnum):
    INTAKE = "intake"
    SYNTHESIS = "synthesis"
    PRIORITIZATION = "prioritization"
    FOUR_QUESTIONS = "four_questions"
    REPO_CONTEXT = "repo_context"
    SPEC_BUILDING = "spec_building"
    SPEC_QA = "spec_qa"
    TASK_PLANNING = "task_planning"
    REVIEW = "review"
    DONE = "done"
    ERROR = "error"

class SessionStatus(StrEnum):
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    ERROR = "error"
    ABANDONED = "abandoned"

class FeedbackEmotion(StrEnum):
    FRUSTRATED = "frustrated"
    CONFUSED = "confused"
    DELIGHTED = "delighted"
    NEUTRAL = "neutral"
    ANGRY = "angry"
    HOPEFUL = "hopeful"
    DISAPPOINTED = "disappointed"

class FeedbackStatus(StrEnum):
    RAW = "raw"
    PROCESSED = "processed"
    ERROR = "error"
    ARCHIVED = "archived"

class SourceType(StrEnum):
    MANUAL_PASTE = "manual_paste"
    FILE_UPLOAD = "file_upload"
    INTERCOM = "intercom"
    ZENDESK = "zendesk"
    SLACK = "slack"
    NOTION = "notion"
    LINEAR = "linear"
    CSV = "csv"
    GOOGLE_FORMS = "google_forms"
    TYPEFORM = "typeform"
    HUBSPOT = "hubspot"
    API = "api"

class SpecStatus(StrEnum):
    DRAFT = "draft"
    REVIEW = "review"
    APPROVED = "approved"
    SHIPPED = "shipped"
    ABANDONED = "abandoned"

class DecisionType(StrEnum):
    BUILD = "build"
    DEFER = "defer"
    KILL = "kill"
    INVESTIGATE = "investigate"

class Urgency(StrEnum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class MilestoneType(StrEnum):
    FIRST_SPEC = "first_spec"
    FIRST_VALIDATED_FEATURE = "first_validated_feature"
    FIRST_SYNTHESIS = "first_synthesis"
    FIRST_CURSOR_PROMPT = "first_cursor_prompt"
    TEN_SESSIONS = "ten_sessions"
    CUSTOM = "custom"


# ============================================================
# BASE
# ============================================================

class TimestampMixin(BaseModel):
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


# ============================================================
# ENTITIES
# ============================================================

class Profile(TimestampMixin):
    id: UUID
    email: str
    full_name: str | None = None
    avatar_url: str | None = None
    org_id: UUID | None = None
    role: MemberRole = MemberRole.MEMBER
    onboarding_done: bool = False
    preferences: dict[str, Any] = Field(default_factory=dict)


class Organization(TimestampMixin):
    id: UUID
    name: str
    slug: str
    plan: OrgPlan = OrgPlan.FREE
    settings: dict[str, Any] = Field(default_factory=dict)


class Project(TimestampMixin):
    id: UUID
    org_id: UUID
    name: str
    description: str | None = None
    repo_url: str | None = None
    repo_provider: str | None = None
    settings: dict[str, Any] = Field(default_factory=dict)
    created_by: UUID | None = None


class FeedbackItem(TimestampMixin):
    id: UUID
    project_id: UUID
    source_id: UUID | None = None
    session_id: UUID | None = None
    raw_text: str
    cleaned_text: str | None = None
    language: str = "en"
    pain: str | None = None
    request: str | None = None
    context: str | None = None
    emotion: FeedbackEmotion | None = None
    jtbd_hint: str | None = None
    segment_guess: str | None = None
    author_name: str | None = None
    author_role: str | None = None
    author_company: str | None = None
    feedback_date: datetime | None = None
    external_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    status: FeedbackStatus = FeedbackStatus.RAW
    processed_at: datetime | None = None


class Session(TimestampMixin):
    id: UUID
    project_id: UUID
    created_by: UUID
    stage: SessionStage = SessionStage.INTAKE
    stage_history: list[dict[str, Any]] = Field(default_factory=list)
    intake_summary: dict[str, Any] | None = None
    four_q_answers: dict[str, Any] | None = None
    pattern_report: dict[str, Any] | None = None
    decision_object: dict[str, Any] | None = None
    spec_object: dict[str, Any] | None = None
    cursor_prompt: str | None = None
    task_plan: dict[str, Any] | None = None
    gate_results: dict[str, Any] = Field(default_factory=dict)
    ambiguity_score: float | None = None
    title: str | None = None
    status: SessionStatus = SessionStatus.ACTIVE
    started_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    completed_at: datetime | None = None
    duration_seconds: int | None = None
    messages: list[dict[str, Any]] = Field(default_factory=list)


class PatternCluster(BaseModel):
    id: UUID
    session_id: UUID
    project_id: UUID
    label: str
    description: str | None = None
    pain_summary: str | None = None
    frequency: int = 0
    severity_score: float | None = None
    confidence: float | None = None
    urgency: Urgency | None = None
    quote_ids: list[UUID] = Field(default_factory=list)
    top_quotes: list[dict[str, Any]] = Field(default_factory=list)
    contradicts: list[UUID] = Field(default_factory=list)
    related_to: list[UUID] = Field(default_factory=list)
    rank: int | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class Spec(TimestampMixin):
    id: UUID
    session_id: UUID
    project_id: UUID
    created_by: UUID
    decision: dict[str, Any]
    ui_changes: dict[str, Any] | None = None
    data_model: dict[str, Any] | None = None
    task_breakdown: dict[str, Any] | None = None
    success_criteria: dict[str, Any] | None = None
    cursor_prompt: str | None = None
    lint_results: dict[str, Any] = Field(default_factory=dict)
    ambiguity_score: float | None = None
    completeness: float | None = None
    grounding_score: float | None = None
    version: int = 1
    parent_spec_id: UUID | None = None
    status: SpecStatus = SpecStatus.DRAFT
    outcome: dict[str, Any] | None = None


class RepoContext(TimestampMixin):
    id: UUID
    project_id: UUID
    stack: dict[str, Any] | None = None
    entities: list[dict[str, Any]] | None = None
    routes: list[dict[str, Any]] | None = None
    auth_model: dict[str, Any] | None = None
    ui_surfaces: list[dict[str, Any]] | None = None
    conventions: dict[str, Any] | None = None
    readme_content: str | None = None
    schema_snapshot: str | None = None
    repo_sha: str | None = None
    indexed_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    is_stale: bool = False
