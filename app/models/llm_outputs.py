"""
Napkin — LLM Structured Output Models
Pydantic models used with LangChain's with_structured_output().
Every field has a default so the LLM can never fail validation on optional data.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


# ============================================================
# INTAKE STRUCTURER
# ============================================================

class IntakeSignal(BaseModel):
    """A single extracted signal from customer feedback."""
    pain: str = ""
    request: str = ""
    context: str = ""
    emotion: str = "neutral"
    jtbd_hint: str = ""
    segment_guess: str = ""
    raw_text_snippet: str = ""
    confidence: float = 0.5


class IntakeResult(BaseModel):
    """Batch extraction result from intake agent."""
    signals: list[IntakeSignal] = Field(default_factory=list)


class IntakeQualityReport(BaseModel):
    """Self-evaluation of extraction quality."""
    low_confidence_count: int = 0
    empty_pain_count: int = 0
    suspicious_patterns: list[str] = Field(default_factory=list)
    needs_reextraction: bool = False
    batch_indices_to_retry: list[int] = Field(default_factory=list)


# ============================================================
# SIGNAL SYNTHESIS
# ============================================================

class ClusterAnalysis(BaseModel):
    """Analysis of a single signal cluster."""
    label: str = ""
    description: str = ""
    pain_summary: str = ""
    severity_score: float = 5.0
    confidence: float = 0.5
    evidence_quotes: list[dict] = Field(default_factory=list)
    signal_ids: list[str] = Field(default_factory=list)


class SynthesisQualityReport(BaseModel):
    """Self-evaluation of synthesis quality."""
    oversized_clusters: list[str] = Field(default_factory=list)
    similar_cluster_pairs: list[list[str]] = Field(default_factory=list)
    underevidence_clusters: list[str] = Field(default_factory=list)
    needs_iteration: bool = False


class MergedSynthesis(BaseModel):
    """Final merged synthesis report."""
    clusters: list[dict] = Field(default_factory=list)
    top_pains: list[str] = Field(default_factory=list)
    contradictions: list[dict] = Field(default_factory=list)
    segments_found: list[str] = Field(default_factory=list)
    confidence_summary: str = ""


# ============================================================
# SOCRATIC QUESTIONER
# ============================================================

class QuestionDecision(BaseModel):
    """Agent's decision on what question to ask next."""
    action: str = "ask"  # "ask" | "followup" | "complete"
    topic: str = ""  # segment_jtbd | smallest_proof | non_goals | constraints
    question_text: str = ""
    reasoning: str = ""


class AnswerExtraction(BaseModel):
    """Structured extraction from a user answer."""
    extracted_data: dict = Field(default_factory=dict)
    quality_score: float = 0.5
    is_vague: bool = False
    followup_needed: str = ""


# ============================================================
# SPEC BUILDER
# ============================================================

class SpecLLMOutput(BaseModel):
    """Raw spec output from LLM before post-processing."""
    decision: dict = Field(default_factory=dict)
    ui_changes: list[dict] = Field(default_factory=list)
    data_model: list[dict] = Field(default_factory=list)
    task_breakdown: list[dict] = Field(default_factory=list)
    success_criteria: list[dict] = Field(default_factory=list)


class SpecSelfCritique(BaseModel):
    """Self-evaluation of spec quality."""
    vague_sections: list[str] = Field(default_factory=list)
    ungrounded_references: list[str] = Field(default_factory=list)
    missing_acceptance_criteria: list[str] = Field(default_factory=list)
    coherence_issues: list[str] = Field(default_factory=list)
    overall_quality: float = 0.5
    needs_revision: bool = False


class LintLLMResult(BaseModel):
    """Lint report from the spec linter."""
    issues: list[dict] = Field(default_factory=list)
    passed: bool = True
    error_count: int = 0
    warning_count: int = 0
    ambiguity_score: float = 0.0


# ============================================================
# PRIORITIZER
# ============================================================

class OpportunityLLMResult(BaseModel):
    """Raw opportunity list from LLM."""
    opportunities: list[dict] = Field(default_factory=list)
    recommendation_reasoning: str = ""
    tradeoff_summary: str = ""


class RankingQualityReport(BaseModel):
    """Self-evaluation of ranking quality."""
    rice_spread_ok: bool = True
    all_fields_filled: bool = True
    issues: list[str] = Field(default_factory=list)
    needs_iteration: bool = False


# ============================================================
# SPEC QA
# ============================================================

class SpecQALLMResult(BaseModel):
    """LLM-powered QA checks (edge cases, executability)."""
    edge_case_issues: list[dict] = Field(default_factory=list)
    edge_case_score: float = 0.8
    fix_suggestions: list[dict] = Field(default_factory=list)


# ============================================================
# TASK PLANNER
# ============================================================

class TaskPlannerLLMResult(BaseModel):
    """Raw task decomposition from LLM."""
    tasks: list[dict] = Field(default_factory=list)


class PlanQualityReport(BaseModel):
    """Self-evaluation of task plan quality."""
    oversized_tasks: list[str] = Field(default_factory=list)
    total_hours: float = 0.0
    capacity_ok: bool = True
    team_balance_ok: bool = True
    dependency_issues: list[str] = Field(default_factory=list)
    needs_iteration: bool = False


# ============================================================
# REPO CONTEXT
# ============================================================

class EntityExtractionResult(BaseModel):
    """Entities extracted from a single file."""
    entities: list[dict] = Field(default_factory=list)


class RouteExtractionResult(BaseModel):
    """Routes extracted from a single file."""
    routes: list[dict] = Field(default_factory=list)


class CoverageReport(BaseModel):
    """Self-evaluation of repo exploration coverage."""
    files_examined: int = 0
    files_total: int = 0
    coverage_pct: float = 0.0
    missed_important_files: list[str] = Field(default_factory=list)
    needs_more_exploration: bool = False
