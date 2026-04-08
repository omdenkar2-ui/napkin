"""Tests for the Strategic Context Inference — infer_strategic_context(pattern_report, priorities) -> dict."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from tests.conftest import make_mock_react_llm, make_pattern_report


# ============================================================
# Test 1: Happy path — infers complete strategic context
# ============================================================

@pytest.mark.asyncio
async def test_infers_complete_context():
    """Should return a dict with all 4Q fields populated and is_complete=True."""
    context_result = {
        "q1_segment_jtbd": "Power users who need fast reporting",
        "q1_evidence": ["sig-1", "sig-2"],
        "q2_smallest_proof": "PDF export button on reports page",
        "q2_scope_notes": "Single-page PDF only",
        "q3_non_goals": ["Dashboard redesign", "Mobile app"],
        "q4_constraints": ["React frontend", "Supabase backend"],
        "q4_risks": ["PDF generation library compatibility"],
        "q4_dependencies": [],
    }
    mock_llm = make_mock_react_llm(context_result)

    with patch("app.services.agents.socratic.get_strong_llm", return_value=mock_llm):
        from app.services.agents.socratic import infer_strategic_context
        result = await infer_strategic_context(
            pattern_report=make_pattern_report(),
            priorities={"opportunities": [{"title": "PDF export"}]},
        )

    assert isinstance(result, dict)
    assert result.get("is_complete") is True
    assert result.get("q1_segment_jtbd")
    assert result.get("q2_smallest_proof")
    assert result.get("q3_non_goals")
    assert result.get("q4_constraints")


# ============================================================
# Test 2: All key fields are present in output
# ============================================================

@pytest.mark.asyncio
async def test_all_fields_present():
    """Output should contain q1 through q4 fields."""
    context_result = {
        "q1_segment_jtbd": "Enterprise admins managing teams",
        "q1_evidence": ["sig-3"],
        "q2_smallest_proof": "Team dashboard widget",
        "q2_scope_notes": "Read-only summary",
        "q3_non_goals": ["Custom branding"],
        "q4_constraints": ["Existing auth system"],
        "q4_risks": ["Adoption risk"],
        "q4_dependencies": ["SSO provider"],
    }
    mock_llm = make_mock_react_llm(context_result)

    with patch("app.services.agents.socratic.get_strong_llm", return_value=mock_llm):
        from app.services.agents.socratic import infer_strategic_context
        result = await infer_strategic_context(
            pattern_report=make_pattern_report(),
            priorities={},
        )

    expected_keys = [
        "q1_segment_jtbd", "q2_smallest_proof", "q3_non_goals",
        "q4_constraints", "q4_risks", "is_complete",
    ]
    for key in expected_keys:
        assert key in result, f"Missing key: {key}"


# ============================================================
# Test 3: Fallback on LLM error
# ============================================================

@pytest.mark.asyncio
async def test_fallback_on_error():
    """If LLM raises an exception, should return fallback context (not crash)."""
    from unittest.mock import MagicMock

    mock_llm = MagicMock()
    structured_mock = MagicMock()
    from unittest.mock import AsyncMock
    structured_mock.ainvoke = AsyncMock(side_effect=Exception("LLM timeout"))
    mock_llm.with_structured_output.return_value = structured_mock

    with patch("app.services.agents.socratic.get_strong_llm", return_value=mock_llm):
        from app.services.agents.socratic import infer_strategic_context
        result = await infer_strategic_context(
            pattern_report=make_pattern_report(),
            priorities={"opportunities": [{"title": "Fix dashboard"}]},
        )

    # Should still return a valid dict with fallback values
    assert isinstance(result, dict)
    assert result.get("is_complete") is True
    assert result.get("q1_segment_jtbd")  # Fallback populates from top_pains


# ============================================================
# Test 4: Empty priorities handled gracefully
# ============================================================

@pytest.mark.asyncio
async def test_empty_priorities():
    """Empty priorities dict should not crash the inference."""
    context_result = {
        "q1_segment_jtbd": "Users reporting dashboard issues",
        "q1_evidence": [],
        "q2_smallest_proof": "Fix top critical issue",
        "q2_scope_notes": "Focus on highest-impact change",
        "q3_non_goals": ["Large-scale refactoring"],
        "q4_constraints": [],
        "q4_risks": ["Scope creep"],
        "q4_dependencies": [],
    }
    mock_llm = make_mock_react_llm(context_result)

    with patch("app.services.agents.socratic.get_strong_llm", return_value=mock_llm):
        from app.services.agents.socratic import infer_strategic_context
        result = await infer_strategic_context(
            pattern_report=make_pattern_report(),
            priorities={},
        )

    assert isinstance(result, dict)
    assert result.get("is_complete") is True


# ============================================================
# Test 5: Non-goals list is populated
# ============================================================

@pytest.mark.asyncio
async def test_non_goals_populated():
    """Output should include q3_non_goals as a list."""
    context_result = {
        "q1_segment_jtbd": "Power users",
        "q1_evidence": ["sig-1"],
        "q2_smallest_proof": "Quick fix",
        "q2_scope_notes": "Minimal scope",
        "q3_non_goals": ["Mobile app", "Redesign", "Migration"],
        "q4_constraints": ["React"],
        "q4_risks": ["Compat"],
        "q4_dependencies": [],
    }
    mock_llm = make_mock_react_llm(context_result)

    with patch("app.services.agents.socratic.get_strong_llm", return_value=mock_llm):
        from app.services.agents.socratic import infer_strategic_context
        result = await infer_strategic_context(
            pattern_report=make_pattern_report(),
            priorities={},
        )

    non_goals = result.get("q3_non_goals", [])
    assert isinstance(non_goals, list)
    assert len(non_goals) >= 1
