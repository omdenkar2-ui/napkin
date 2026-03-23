"""Tests for the Socratic Questioner agent (Agent 3)."""

from __future__ import annotations

import json
from unittest.mock import patch

import pytest

from tests.conftest import make_mock_react_llm, make_pattern_report


# ============================================================
# Test 1: No answers -> asks Q1
# ============================================================

@pytest.mark.asyncio
async def test_no_answers_asks_q1():
    """With no answers, node should ask the first question."""
    mock_llm = make_mock_react_llm("Who is your primary user segment?")

    with patch("app.services.agents.mvp.socratic.get_strong_llm", return_value=mock_llm):
        from app.services.agents.mvp.socratic import socratic_questioner_node
        state = {
            "pattern_report": make_pattern_report(),
            "four_q_answers": {},
            "user_response": None,
            "messages": [],
        }
        result = await socratic_questioner_node(state)

    assert result.get("pending_questions")
    four_q = result.get("four_q_answers", {})
    assert not four_q.get("is_complete")


# ============================================================
# Test 2: Good answer -> advances to next question
# ============================================================

@pytest.mark.asyncio
async def test_good_answer_advances():
    """A valid answer to Q1 should populate q1_segment_jtbd."""
    # Mock returns extraction result for synthesize_answer tool
    extract_result = {
        "extracted_data": {
            "segment_jtbd": "Power users who need fast reports",
            "evidence": ["sig-1"],
        },
        "quality_score": 0.9,
        "is_vague": False,
        "followup_needed": "",
    }
    mock_llm = make_mock_react_llm(extract_result)

    with patch("app.services.agents.mvp.socratic.get_strong_llm", return_value=mock_llm):
        from app.services.agents.mvp.socratic import socratic_questioner_node
        state = {
            "pattern_report": make_pattern_report(),
            "four_q_answers": {},
            "user_response": "Power users who need fast reporting",
            "messages": [],
        }
        result = await socratic_questioner_node(state)

    four_q = result.get("four_q_answers", {})
    assert four_q.get("q1_segment_jtbd")


# ============================================================
# Test 3: Vague pushback -> still stores answer
# ============================================================

@pytest.mark.asyncio
async def test_vague_pushback_stays():
    """If extraction fails, raw answer is stored as fallback."""
    mock_llm = make_mock_react_llm("not valid structured data")

    with patch("app.services.agents.mvp.socratic.get_strong_llm", return_value=mock_llm):
        from app.services.agents.mvp.socratic import socratic_questioner_node
        state = {
            "pattern_report": make_pattern_report(),
            "four_q_answers": {},
            "user_response": "I dunno, everyone I guess",
            "messages": [],
        }
        result = await socratic_questioner_node(state)

    # Raw answer stored as fallback
    four_q = result.get("four_q_answers", {})
    assert four_q.get("q1_segment_jtbd")


# ============================================================
# Test 4: Full flow -> is_complete=True
# ============================================================

@pytest.mark.asyncio
async def test_full_flow_completes():
    """All 4 answers provided should result in is_complete=True."""
    extract_result = {
        "extracted_data": {"constraints": ["React"], "risks": ["compat"]},
        "quality_score": 0.8,
        "is_vague": False,
        "followup_needed": "",
    }
    mock_llm = make_mock_react_llm(extract_result)

    with patch("app.services.agents.mvp.socratic.get_strong_llm", return_value=mock_llm):
        from app.services.agents.mvp.socratic import socratic_questioner_node
        state = {
            "pattern_report": make_pattern_report(),
            "four_q_answers": {
                "q1_segment_jtbd": "Power users",
                "q2_smallest_proof": "PDF export",
                "q3_non_goals": ["Mobile app"],
            },
            "user_response": "React frontend, Supabase backend",
            "messages": [],
        }
        result = await socratic_questioner_node(state)

    four_q = result.get("four_q_answers", {})
    assert four_q.get("is_complete") is True
    assert not result.get("pending_questions")


# ============================================================
# Test 5: Resume from partial state
# ============================================================

@pytest.mark.asyncio
async def test_resume_from_partial():
    """Node should continue from where it left off (Q1 done, answer Q2)."""
    extract_result = {
        "extracted_data": {"smallest_proof": "PDF button on reports"},
        "quality_score": 0.9,
        "is_vague": False,
        "followup_needed": "",
    }
    mock_llm = make_mock_react_llm(extract_result)

    with patch("app.services.agents.mvp.socratic.get_strong_llm", return_value=mock_llm):
        from app.services.agents.mvp.socratic import socratic_questioner_node
        state = {
            "pattern_report": make_pattern_report(),
            "four_q_answers": {
                "q1_segment_jtbd": "Power users",
            },
            "user_response": "Just add a PDF export button",
            "messages": [],
        }
        result = await socratic_questioner_node(state)

    four_q = result.get("four_q_answers", {})
    assert four_q.get("q1_segment_jtbd")
    assert four_q.get("q2_smallest_proof")
