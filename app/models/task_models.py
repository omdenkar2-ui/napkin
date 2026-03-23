"""
Napkin Backend — Task Planner Models

Pydantic models for the Task Planner + Assigner agent (Agent 8).
"""

from __future__ import annotations

from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field


class PlannedTask(BaseModel):
    """A single task in the sprint plan."""

    id: str = Field(default_factory=lambda: str(uuid4())[:8])
    title: str
    description: str = ""
    type: Literal["FE", "BE", "DB", "INFRA", "TEST"] = "BE"
    estimate_hours: float = 0.0
    priority: Literal["P0", "P1", "P2"] = "P1"
    dependencies: list[str] = Field(default_factory=list)  # task IDs
    acceptance_criteria: list[str] = Field(default_factory=list)
    assigned_to: str | None = None
    sprint_day: int | None = None  # day 1-10 in a 2-week sprint
    blocked_by: list[str] = Field(default_factory=list)
    spec_section: str = ""


class TaskPlan(BaseModel):
    """A complete sprint plan produced by the Task Planner."""

    tasks: list[PlannedTask] = Field(default_factory=list)
    total_hours: float = 0.0
    critical_path: list[str] = Field(default_factory=list)  # ordered task IDs
    sprint_checkpoints: list[dict] = Field(default_factory=list)
    risk_flags: list[str] = Field(default_factory=list)
    team_load: dict[str, float] = Field(default_factory=dict)  # {role: hours}
