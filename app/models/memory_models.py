"""
Napkin Backend — Decision Log & Memory Models

Pydantic models for the Decision Log & Memory agent (Agent 9).
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from pydantic import BaseModel, Field


class DecisionRecord(BaseModel):
    """A stored decision from a completed session."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    project_id: str = ""
    session_id: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    # What was decided
    decision_summary: str = ""
    spec_title: str | None = None
    chosen_opportunity: str | None = None
    rejected_alternatives: list[str] = Field(default_factory=list)

    # Context
    top_patterns: list[str] = Field(default_factory=list)
    segments: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    non_goals: list[str] = Field(default_factory=list)

    # Outcome (filled later via record_outcome)
    outcome_status: str = "pending"  # pending, shipped, validated, failed, reverted
    outcome_notes: str | None = None
    outcome_date: datetime | None = None

    # Learnings
    learnings: list[str] = Field(default_factory=list)


class ProjectMemory(BaseModel):
    """Accumulated memory for a project across sessions."""

    project_id: str
    decision_count: int = 0
    recent_decisions: list[DecisionRecord] = Field(default_factory=list)
    known_constraints: list[str] = Field(default_factory=list)
    known_non_goals: list[str] = Field(default_factory=list)
    successful_patterns: list[str] = Field(default_factory=list)
    failed_patterns: list[str] = Field(default_factory=list)
    team_defaults: dict = Field(default_factory=dict)
