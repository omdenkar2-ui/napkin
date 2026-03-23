"""Tests for the Decision Log & Memory agent (Agent 9)."""

from __future__ import annotations

import pytest

from tests.conftest import make_four_q_answers, make_pattern_report, make_spec


# ============================================================
# Test 1: Store → valid DecisionRecord
# ============================================================

@pytest.mark.asyncio
async def test_store_decision():
    """Storing a decision should return a valid record."""
    from app.services.agents.final.memory import clear_memory_store, store_decision

    clear_memory_store()

    session_state = {
        "project_id": "proj-1",
        "session_id": "sess-1",
        "four_q_answers": make_four_q_answers(),
        "pattern_report": make_pattern_report(),
        "prioritization_result": {
            "recommended": "opp-1",
            "opportunities": [
                {"id": "opp-1", "title": "Speed up dashboard"},
                {"id": "opp-2", "title": "Add PDF export"},
            ],
        },
    }

    record = await store_decision(session_state, make_spec())

    assert record["project_id"] == "proj-1"
    assert record["session_id"] == "sess-1"
    assert record["decision_summary"]
    assert record["outcome_status"] == "pending"
    assert record["id"]


# ============================================================
# Test 2: Retrieve empty → no suggestions
# ============================================================

@pytest.mark.asyncio
async def test_retrieve_empty():
    """Retrieving from empty store should return empty context."""
    from app.services.agents.final.memory import retrieve_context

    result = await retrieve_context("nonexistent-project", memory_store={})

    assert result["relevant_decisions"] == []
    assert result["known_constraints"] == []
    assert result["known_non_goals"] == []
    assert result["suggestions"] == []


# ============================================================
# Test 3: Retrieve with history → relevant decisions
# ============================================================

@pytest.mark.asyncio
async def test_retrieve_with_history():
    """Past decisions should be returned when project has history."""
    from app.services.agents.final.memory import retrieve_context

    store = {
        "proj-1": [
            {
                "id": "dec-1",
                "project_id": "proj-1",
                "session_id": "sess-1",
                "created_at": "2026-01-01T00:00:00",
                "decision_summary": "Built PDF export",
                "spec_title": "PDF Export",
                "top_patterns": ["Missing PDF export"],
                "segments": ["power-user"],
                "constraints": ["React frontend"],
                "non_goals": ["Mobile app"],
                "outcome_status": "pending",
                "outcome_notes": None,
                "learnings": [],
            },
        ],
    }

    result = await retrieve_context(
        "proj-1",
        current_patterns=["Missing PDF export"],
        memory_store=store,
    )

    assert len(result["relevant_decisions"]) == 1
    assert "React frontend" in result["known_constraints"]
    assert "Mobile app" in result["known_non_goals"]


# ============================================================
# Test 4: Record outcome → status updated
# ============================================================

@pytest.mark.asyncio
async def test_record_outcome():
    """Recording an outcome should update the decision record."""
    from app.services.agents.final.memory import record_outcome

    store = {
        "proj-1": [
            {
                "id": "dec-1",
                "project_id": "proj-1",
                "outcome_status": "pending",
                "outcome_notes": None,
                "outcome_date": None,
                "learnings": [],
                "spec_title": "PDF Export",
            },
        ],
    }

    result = await record_outcome(
        "dec-1",
        shipped=False,
        notes="PDF lib was incompatible",
        memory_store=store,
    )

    assert result["outcome_status"] == "failed"
    assert result["outcome_notes"] == "PDF lib was incompatible"
    assert "PDF lib was incompatible" in result["learnings"]
