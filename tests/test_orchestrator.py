"""Tests for the MVP Orchestrator (9-stage pipeline)."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.conftest import (
    make_four_q_answers,
    make_mock_react_llm,
    make_pattern_report,
    make_repo_files,
    make_signals,
    make_spec,
)


# ============================================================
# Test 1: Graph builds with correct 10 nodes
# ============================================================

def test_graph_builds():
    """Graph should build with 10 nodes (9 stages + handle_error)."""
    from app.services.agents.mvp.orchestrator import build_session_graph
    graph = build_session_graph()

    node_names = set(graph.nodes.keys())
    expected = {
        "intake", "synthesis", "prioritization", "four_questions",
        "repo_context", "spec_building", "spec_qa", "task_planning",
        "done", "handle_error",
    }
    assert expected.issubset(node_names)


# ============================================================
# Test 2: intake_node auto-advances with enough items
# ============================================================

@pytest.mark.asyncio
async def test_intake_advances_to_synthesis():
    """Intake with >=3 items should auto-advance to synthesis."""
    mock_llm = make_mock_react_llm({
        "signals": [
            {"pain": f"Pain {i}", "request": f"Req {i}", "emotion": "neutral",
             "context": "enterprise", "jtbd_hint": "Work", "segment_guess": "user",
             "raw_text_snippet": f"Text {i}", "confidence": 0.8}
            for i in range(5)
        ]
    })

    with patch("app.services.agents.mvp.intake.get_fast_llm", return_value=mock_llm), \
         patch("app.services.agents.final.memory.retrieve_context", new_callable=AsyncMock, return_value={}):
        from app.services.agents.mvp.orchestrator import intake_node
        state = {
            "raw_texts": ["feedback 1", "feedback 2", "feedback 3"],
            "feedback_items": [],
            "messages": [],
            "project_id": "proj-1",
            "stage_history": [],
        }
        result = await intake_node(state)

    assert result.get("stage") == "synthesis"


# ============================================================
# Test 3: synthesis_node advances to prioritization
# ============================================================

@pytest.mark.asyncio
async def test_synthesis_advances_to_prioritization():
    """Synthesis with pattern_report should advance to prioritization."""
    mock_llm = make_mock_react_llm({
        "clusters": [
            {"id": "c1", "label": "Theme 1", "pain_summary": "Pain 1",
             "frequency": 10, "severity": 8.0, "confidence": 0.9,
             "urgency": "high", "evidence_quotes": [{"text": "Q1", "signal_id": "s1"}],
             "signal_ids": ["s1"]},
        ],
        "top_pains": ["Theme 1"],
        "segments_found": ["power-user"],
        "contradictions": [],
        "total_signals_analyzed": 5,
        "confidence_summary": "High.",
    })

    with patch("app.services.agents.mvp.synthesis.get_strong_llm", return_value=mock_llm):
        from app.services.agents.mvp.orchestrator import synthesis_node
        state = {
            "feedback_items": make_signals(5),
            "messages": [],
            "stage_history": [],
        }
        result = await synthesis_node(state)

    assert result.get("stage") == "prioritization"


# ============================================================
# Test 4: spec_qa_node blocks on failure
# ============================================================

@pytest.mark.asyncio
async def test_spec_qa_blocks_on_failure():
    """Spec QA with errors should stay at spec_qa stage with questions."""
    from app.services.agents.mvp.orchestrator import spec_qa_node

    bad_spec = make_spec()
    bad_spec["cursor_prompt"] = "improve everything and optimize it"

    state = {
        "spec_object": bad_spec,
        "four_q_answers": make_four_q_answers(),
        "repo_context": None,
        "messages": [],
        "stage_history": [],
    }
    result = await spec_qa_node(state)

    assert result.get("stage") == "spec_qa"
    assert result.get("spec_qa_report", {}).get("passed") is False


# ============================================================
# Test 5: repo_context_node without files skips
# ============================================================

@pytest.mark.asyncio
async def test_repo_context_skips_without_files():
    """No repo_files should skip to spec_building."""
    from app.services.agents.mvp.orchestrator import repo_context_node

    state = {
        "repo_files": {},
        "messages": [],
        "stage_history": [],
    }
    result = await repo_context_node(state)

    assert result.get("stage") == "spec_building"
    assert result.get("repo_context") is None


# ============================================================
# Test 6: task_planning_node completes session
# ============================================================

@pytest.mark.asyncio
async def test_task_planning_completes():
    """Task planning should advance to export stage with sprint_plan."""
    mock_llm = make_mock_react_llm({
        "tasks": [
            {"id": "t1", "title": "Task 1", "type": "BE",
             "estimate_hours": 4, "dependencies": [],
             "acceptance_criteria": ["Done"]},
        ]
    })

    with patch("app.core.llm.get_strong_llm", return_value=mock_llm), \
         patch("app.services.agents.final.memory.store_decision", new_callable=AsyncMock, return_value={}):
        from app.services.agents.mvp.orchestrator import task_planning_node
        state = {
            "spec_object": make_spec(),
            "messages": [],
            "stage_history": [],
            "project_id": "proj-1",
            "session_id": "sess-1",
        }
        result = await task_planning_node(state)

    assert result.get("stage") == "export"
    assert result.get("sprint_plan")
