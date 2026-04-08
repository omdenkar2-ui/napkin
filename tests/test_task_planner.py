"""Tests for the Task Planner agent (Agent 8)."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from tests.conftest import make_mock_react_llm, make_spec


def _planner_result() -> dict:
    """Build a mock structured output result for task planning."""
    return {
        "tasks": [
            {
                "id": "t1",
                "title": "Create export_job table",
                "description": "Migration for export tracking",
                "type": "DB",
                "estimate_hours": 2.0,
                "priority": "P0",
                "dependencies": [],
                "acceptance_criteria": ["Table exists"],
            },
            {
                "id": "t2",
                "title": "Build export API endpoint",
                "description": "POST /api/exports",
                "type": "BE",
                "estimate_hours": 3.0,
                "priority": "P0",
                "dependencies": ["t1"],
                "acceptance_criteria": ["Returns 200"],
            },
            {
                "id": "t3",
                "title": "Build ExportButton component",
                "description": "React PDF trigger",
                "type": "FE",
                "estimate_hours": 4.0,
                "priority": "P1",
                "dependencies": ["t2"],
                "acceptance_criteria": ["Button renders"],
            },
        ]
    }


# ============================================================
# Test 1: Spec → ordered tasks with dependencies
# ============================================================

@pytest.mark.asyncio
async def test_ordered_tasks():
    """Spec should produce ordered tasks with correct dependencies."""
    mock_llm = make_mock_react_llm(_planner_result())

    from app.services.agents.task_planner import run_task_planner
    spec = make_spec()
    result = await run_task_planner(spec, llm=mock_llm)

    tasks = result.get("tasks", [])
    assert len(tasks) == 3
    assert result.get("total_hours") > 0
    assert result.get("critical_path")


# ============================================================
# Test 2: DB before BE before FE in critical path
# ============================================================

@pytest.mark.asyncio
async def test_db_before_be_before_fe():
    """Critical path should order DB → BE → FE."""
    mock_llm = make_mock_react_llm(_planner_result())

    from app.services.agents.task_planner import run_task_planner
    spec = make_spec()
    result = await run_task_planner(spec, llm=mock_llm)

    cp = result.get("critical_path", [])
    assert len(cp) >= 2

    # Find task types in critical path order
    task_by_id = {t["id"]: t for t in result["tasks"]}
    cp_types = [task_by_id[tid]["type"] for tid in cp if tid in task_by_id]

    if "DB" in cp_types and "BE" in cp_types:
        assert cp_types.index("DB") < cp_types.index("BE")
    if "BE" in cp_types and "FE" in cp_types:
        assert cp_types.index("BE") < cp_types.index("FE")


# ============================================================
# Test 3: Sprint checkpoints at days 3, 5, 8, 10
# ============================================================

@pytest.mark.asyncio
async def test_sprint_checkpoints():
    """Sprint plan should have checkpoints at days 3, 5, 8, 10."""
    mock_llm = make_mock_react_llm(_planner_result())

    from app.services.agents.task_planner import run_task_planner
    spec = make_spec()
    result = await run_task_planner(spec, llm=mock_llm)

    checkpoints = result.get("sprint_checkpoints", [])
    assert len(checkpoints) == 4
    days = [cp["day"] for cp in checkpoints]
    assert days == [3, 5, 8, 10]


# ============================================================
# Test 4: Risk flag if total > 80h
# ============================================================

@pytest.mark.asyncio
async def test_risk_flag_over_80h():
    """Total hours > 80 should trigger a risk flag."""
    heavy_result = {
        "tasks": [
            {
                "id": f"t{i}",
                "title": f"Big task {i}",
                "type": "BE",
                "estimate_hours": 20.0,
                "dependencies": [],
                "acceptance_criteria": ["Done"],
            }
            for i in range(5)  # 5 * 20 = 100h
        ]
    }
    mock_llm = make_mock_react_llm(heavy_result)

    from app.services.agents.task_planner import run_task_planner
    spec = make_spec()
    result = await run_task_planner(spec, llm=mock_llm)

    assert result.get("total_hours") > 80
    risk_flags = result.get("risk_flags", [])
    assert any("80h" in flag or "capacity" in flag.lower() for flag in risk_flags)
