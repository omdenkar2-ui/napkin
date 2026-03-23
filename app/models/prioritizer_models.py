"""
Napkin Backend — Opportunity Prioritizer Models

Pydantic models for the Opportunity Prioritizer agent (Agent 7).
RICE scoring: (Reach * Impact * Confidence) / Effort
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from pydantic import BaseModel, Field


class Opportunity(BaseModel):
    """A single opportunity candidate derived from pattern clusters."""

    id: str = Field(default_factory=lambda: str(uuid4())[:8])
    title: str
    description: str = ""
    source_patterns: list[str] = Field(default_factory=list)
    segments_served: list[str] = Field(default_factory=list)

    # RICE scoring inputs
    reach: int = 0
    impact: float = 0.0  # 0-3 (minimal, low, medium, high)
    confidence: float = 0.0  # 0-1
    effort_weeks: float = 1.0  # estimated dev weeks (never 0)

    # Computed
    rice_score: float = 0.0
    rank: int = 0

    risks: list[str] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list)
    non_goals_if_chosen: list[str] = Field(default_factory=list)


class DecisionObject(BaseModel):
    """Ranked opportunities with a recommendation."""

    opportunities: list[Opportunity] = Field(default_factory=list)
    recommended: str | None = None  # id of top pick
    recommendation_reasoning: str = ""
    tradeoff_summary: str = ""
    generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
