"""
Napkin Backend — Session State Models

The master state model for the Session Director (LangGraph orchestrator).
Contains all Pydantic domain objects and the TypedDict-based SessionState
that flows through the graph.

Design notes:
- Nested models use Pydantic BaseModel for validation and serialization.
- SessionState uses TypedDict because LangGraph needs dict-based state
  for partial updates between nodes.
- Every agent reads from and writes to SessionState as serialized dicts.
"""

from __future__ import annotations

from enum import StrEnum
from typing import TypedDict
from uuid import uuid4

from pydantic import BaseModel, Field


# ============================================================
# ENUMS
# ============================================================

class SessionStage(StrEnum):
    """The stages of a Napkin session plus error."""
    INTAKE = "intake"
    SYNTHESIS = "synthesis"
    PRIORITIZATION = "prioritization"
    FOUR_QUESTIONS = "four_questions"
    REPO_CONTEXT = "repo_context"
    SPEC_BUILDING = "spec_building"
    SPEC_QA = "spec_qa"
    TASK_PLANNING = "task_planning"
    DONE = "done"
    ERROR = "error"


# ============================================================
# NESTED MODELS (Pydantic BaseModel for validation)
# ============================================================

class ExtractedSignal(BaseModel):
    """One structured feedback item extracted from raw text."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    raw_text: str
    pain: str | None = None
    request: str | None = None
    context: str | None = None
    emotion: str | None = None
    jtbd_hint: str | None = None
    segment_guess: str | None = None
    source_label: str | None = None
    confidence: float = 0.0


class ThemeCluster(BaseModel):
    """A discovered pattern/theme from synthesis."""
    id: str = Field(default_factory=lambda: str(uuid4())[:8])
    label: str
    pain_summary: str
    frequency: int = 0
    severity: float = 0.0
    confidence: float = 0.0
    urgency: str = "medium"
    evidence_quotes: list[dict] = Field(default_factory=list)
    signal_ids: list[str] = Field(default_factory=list)


class Contradiction(BaseModel):
    """A detected contradiction between feedback clusters."""
    cluster_a_label: str
    cluster_b_label: str
    description: str
    segment_split: str | None = None


class PatternReport(BaseModel):
    """Output of Signal Synthesis — decision-ready patterns."""
    clusters: list[ThemeCluster] = Field(default_factory=list)
    top_pains: list[str] = Field(default_factory=list)
    contradictions: list[Contradiction] = Field(default_factory=list)
    total_signals_analyzed: int = 0
    segments_found: list[str] = Field(default_factory=list)
    confidence_summary: str = ""


class FourQAnswers(BaseModel):
    """Answers to the 4 strategic questions."""
    q1_segment_jtbd: str | None = None
    q1_evidence: list[str] = Field(default_factory=list)
    q2_smallest_proof: str | None = None
    q2_scope_notes: str | None = None
    q3_non_goals: list[str] = Field(default_factory=list)
    q4_constraints: list[str] = Field(default_factory=list)
    q4_risks: list[str] = Field(default_factory=list)
    q4_dependencies: list[str] = Field(default_factory=list)

    def answered_count(self) -> int:
        """How many of the 4 questions have been answered."""
        count = 0
        if self.q1_segment_jtbd:
            count += 1
        if self.q2_smallest_proof:
            count += 1
        if self.q3_non_goals:
            count += 1
        if self.q4_constraints or self.q4_risks:
            count += 1
        return count

    @property
    def is_complete(self) -> bool:
        """All 4 questions must be answered to proceed."""
        return self.answered_count() >= 4


class SpecObject(BaseModel):
    """The 6-section spec — Napkin's core deliverable."""
    decision: dict = Field(default_factory=dict)
    ui_changes: list[dict] = Field(default_factory=list)
    data_model: list[dict] = Field(default_factory=list)
    task_breakdown: list[dict] = Field(default_factory=list)
    success_criteria: list[dict] = Field(default_factory=list)
    cursor_prompt: str = ""


class GateCheck(BaseModel):
    """Result of a single quality gate check."""
    name: str
    passed: bool
    details: str = ""
    blockers: list[str] = Field(default_factory=list)


class GateResults(BaseModel):
    """Aggregated results of all quality gates run at a given stage."""
    evidence: GateCheck | None = None
    pattern_quality: GateCheck | None = None
    constraint_completeness: GateCheck | None = None
    ambiguity: GateCheck | None = None

    @property
    def all_passed(self) -> bool:
        """True only if every active gate passed."""
        gates = [self.evidence, self.pattern_quality,
                 self.constraint_completeness, self.ambiguity]
        active = [g for g in gates if g is not None]
        return len(active) > 0 and all(g.passed for g in active)

    @property
    def all_blockers(self) -> list[str]:
        """Collect all blocker messages from failing gates."""
        blockers: list[str] = []
        for g in [self.evidence, self.pattern_quality,
                  self.constraint_completeness, self.ambiguity]:
            if g and not g.passed:
                blockers.extend(g.blockers)
        return blockers


# ============================================================
# LANGGRAPH STATE (TypedDict for partial-update semantics)
# ============================================================

class SessionState(TypedDict, total=False):
    """
    The master state that flows through the LangGraph orchestrator.

    Uses TypedDict (not BaseModel) because LangGraph requires dict-based
    state for partial updates between nodes. Each node returns only the
    keys it changed.
    """

    # Identity
    session_id: str
    project_id: str
    user_id: str

    # Stage machine
    stage: str
    stage_history: list[dict]

    # User inputs
    raw_texts: list[str]
    user_response: str | None

    # Pipeline data (accumulated as stages complete)
    signals: list[dict]
    pattern_report: dict | None
    four_q_answers: dict | None
    spec_object: dict | None

    # Enhancement agents data
    repo_files: dict | None
    repo_context: dict | None
    prioritization_result: dict | None
    spec_qa_report: dict | None
    sprint_plan: dict | None
    memory_context: dict | None

    # Quality
    gate_results: dict | None

    # Conversation
    messages: list[dict]
    pending_question: str | None

    # Control
    retry_count: int
    error: str | None
