"""
Napkin Backend — Agent State Models
These are the typed state objects that flow through LangGraph agent pipelines.
Every agent reads from and writes to these structured objects.
"""

from datetime import UTC, datetime
from typing import Any, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from app.models.entities import (
    FeedbackEmotion,
    SessionStage,
    Urgency,
)

# ============================================================
# FEEDBACK SIGNAL (atomic extracted unit)
# ============================================================

class ExtractedSignal(BaseModel):
    """Output of Signal Extractor — one per feedback item."""
    feedback_item_id: UUID
    source_id: UUID | None = None
    pain: str | None = None
    request: str | None = None
    context: str | None = None
    emotion: FeedbackEmotion | None = None
    jtbd_hint: str | None = None
    segment_guess: str | None = None
    raw_text: str
    author_name: str | None = None
    confidence: float = 0.0


# ============================================================
# PATTERN REPORT (output of Signal Synthesis Agent)
# ============================================================

class EvidenceQuote(BaseModel):
    """A single evidence quote linked to a feedback item."""
    text: str
    source_id: UUID | None = None
    feedback_item_id: UUID | None = None
    author: str | None = None
    segment: str | None = None


class ThemeCluster(BaseModel):
    """A single theme/pain cluster discovered in feedback."""
    id: str = Field(default_factory=lambda: str(uuid4())[:8])
    label: str
    description: str
    pain_summary: str
    frequency: int = 0
    severity_score: float = Field(ge=0, le=10)
    confidence: float = Field(ge=0, le=1)
    urgency: Urgency = Urgency.MEDIUM
    quotes: list[EvidenceQuote] = Field(default_factory=list)
    feedback_item_ids: list[UUID] = Field(default_factory=list)
    segment_breakdown: dict[str, int] = Field(default_factory=dict)


class Contradiction(BaseModel):
    """A detected contradiction between feedback signals."""
    cluster_a: str   # cluster label
    cluster_b: str
    description: str
    segment_split: str | None = None  # which segments disagree


class PatternReport(BaseModel):
    """Full output of Signal Synthesis Agent — decision-ready patterns."""
    clusters: list[ThemeCluster] = Field(default_factory=list)
    top_pains: list[str] = Field(default_factory=list)  # ordered cluster labels
    contradictions: list[Contradiction] = Field(default_factory=list)
    total_items_analyzed: int = 0
    segments_found: list[str] = Field(default_factory=list)
    confidence_summary: str = ""
    generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


# ============================================================
# FOUR STRATEGIC QUESTIONS (output of Socratic Questioner)
# ============================================================

class FourQAnswers(BaseModel):
    """Structured answers to the 4 strategic questions."""

    # Q1: Who is the user and what job are they hiring this for?
    q1_segment_jtbd: str | None = None
    q1_evidence: list[str] = Field(default_factory=list)

    # Q2: What's the smallest thing we can build in 2 weeks to prove this?
    q2_smallest_proof: str | None = None
    q2_scope_notes: str | None = None

    # Q3: What are we explicitly NOT building?
    q3_non_goals: list[str] = Field(default_factory=list)

    # Q4: What constraints and risks should the builder know?
    q4_constraints: list[str] = Field(default_factory=list)
    q4_risks: list[str] = Field(default_factory=list)
    q4_dependencies: list[str] = Field(default_factory=list)

    is_complete: bool = False


# ============================================================
# SPEC OBJECT (output of Spec & Prompt Builder Agent)
# ============================================================

class SpecDecision(BaseModel):
    """Section 1: The decision — what to build and why."""
    what: str
    why: str
    evidence_refs: list[str] = Field(default_factory=list)
    segment: str | None = None
    jtbd: str | None = None


class UIChange(BaseModel):
    screen: str
    component: str | None = None
    description: str
    flow_notes: str | None = None


class DataModelChange(BaseModel):
    entity: str
    action: Literal["create", "modify", "delete"]
    fields: list[dict[str, str]] = Field(default_factory=list)
    migration_notes: str | None = None
    relations: list[str] = Field(default_factory=list)


class TaskItem(BaseModel):
    title: str
    description: str
    type: Literal["FE", "BE", "DB", "INFRA", "TEST"]
    estimate_hours: float | None = None
    dependencies: list[str] = Field(default_factory=list)
    acceptance_criteria: list[str] = Field(default_factory=list)


class SuccessMetric(BaseModel):
    name: str
    target: str
    timeframe: str = "2 weeks"
    measurement_method: str | None = None


class SpecObject(BaseModel):
    """The full 6-section spec — Napkin's core deliverable."""
    decision: SpecDecision
    ui_changes: list[UIChange] = Field(default_factory=list)
    data_model: list[DataModelChange] = Field(default_factory=list)
    task_breakdown: list[TaskItem] = Field(default_factory=list)
    success_criteria: list[SuccessMetric] = Field(default_factory=list, max_length=3)
    cursor_prompt: str = ""

    # Quality metadata
    version: int = 1
    ambiguity_score: float | None = None
    completeness: float | None = None
    grounding_score: float | None = None


# ============================================================
# LINT RESULTS (output of Spec Linter / QA Agent)
# ============================================================

class LintIssue(BaseModel):
    severity: Literal["error", "warning", "info"]
    category: Literal[
        "ambiguity", "missing_field", "inconsistency",
        "grounding", "edge_case", "executability"
    ]
    message: str
    section: str | None = None
    suggestion: str | None = None


class LintReport(BaseModel):
    issues: list[LintIssue] = Field(default_factory=list)
    passed: bool = True
    error_count: int = 0
    warning_count: int = 0
    ambiguity_score: float = 0.0   # 0 = no ambiguity, 1 = very ambiguous


# ============================================================
# GATE RESULTS (quality gate checks)
# ============================================================

class GateCheck(BaseModel):
    name: str
    passed: bool
    details: str = ""
    blockers: list[str] = Field(default_factory=list)


class GateResults(BaseModel):
    evidence_gate: GateCheck | None = None
    constraint_gate: GateCheck | None = None
    grounding_gate: GateCheck | None = None
    ambiguity_gate: GateCheck | None = None
    all_passed: bool = False


# ============================================================
# REPO SNAPSHOT (for grounding prompts in real code)
# ============================================================

class RepoSnapshot(BaseModel):
    """Minimal repo context for MVP — README + schema + routes."""
    readme: str | None = None
    schema_text: str | None = None
    routes_text: str | None = None
    file_tree: list[str] = Field(default_factory=list)
    stack_guess: dict[str, str] = Field(default_factory=dict)


# ============================================================
# SESSION STATE (the master state object for LangGraph)
# ============================================================

class SessionState(BaseModel):
    """
    Master state object that flows through the LangGraph orchestrator.
    Every agent reads from and writes to this.
    This IS the LangGraph state.
    """

    # Identity
    session_id: UUID = Field(default_factory=uuid4)
    project_id: UUID
    user_id: UUID

    # Stage machine
    stage: SessionStage = SessionStage.INTAKE
    stage_history: list[dict[str, Any]] = Field(default_factory=list)

    # Raw inputs
    feedback_items: list[ExtractedSignal] = Field(default_factory=list)
    raw_texts: list[str] = Field(default_factory=list)  # before extraction
    uploaded_file_ids: list[UUID] = Field(default_factory=list)

    # Agent outputs (populated as pipeline progresses)
    pattern_report: PatternReport | None = None
    four_q_answers: FourQAnswers | None = None
    spec_object: SpecObject | None = None
    repo_snapshot: RepoSnapshot | None = None

    # Quality
    gate_results: GateResults = Field(default_factory=GateResults)
    lint_report: LintReport | None = None

    # Conversation
    messages: list[dict[str, Any]] = Field(default_factory=list)
    pending_questions: list[str] = Field(default_factory=list)
    user_response: str | None = None

    # Control
    retry_count: int = 0
    max_retries: int = 3
    error: str | None = None
    is_complete: bool = False

    class Config:
        arbitrary_types_allowed = True
