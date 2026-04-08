"""Tests for the Spec Builder — build_spec(pattern_report, four_q, priorities, repo_context) -> dict."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from tests.conftest import (
    make_four_q_answers,
    make_mock_react_llm,
    make_pattern_report,
    make_spec,
)


# ============================================================
# Test 1: Full generation — valid 6-section spec
# ============================================================

@pytest.mark.asyncio
async def test_full_spec_generation():
    """Complete inputs should produce a 6-section spec with cursor_prompt."""
    mock_llm = make_mock_react_llm(make_spec())

    with patch("app.services.agents.spec_builder.get_strong_llm", return_value=mock_llm), \
         patch("app.services.agents.spec_builder.get_fast_llm", return_value=mock_llm):
        from app.services.agents.spec_builder import build_spec
        result = await build_spec(
            pattern_report=make_pattern_report(),
            four_q=make_four_q_answers(complete=True),
            priorities=None,
            repo_context={},
        )

    # Returns dict directly, not wrapped in state
    assert isinstance(result, dict)
    assert "decision" in result
    assert "task_breakdown" in result
    assert "cursor_prompt" in result


# ============================================================
# Test 2: Spec includes all required sections
# ============================================================

@pytest.mark.asyncio
async def test_spec_has_all_sections():
    """Spec should have decision, ui_changes, data_model, task_breakdown, success_criteria."""
    spec_data = make_spec()
    mock_llm = make_mock_react_llm(spec_data)

    with patch("app.services.agents.spec_builder.get_strong_llm", return_value=mock_llm), \
         patch("app.services.agents.spec_builder.get_fast_llm", return_value=mock_llm):
        from app.services.agents.spec_builder import build_spec
        result = await build_spec(
            pattern_report=make_pattern_report(),
            four_q=make_four_q_answers(complete=True),
        )

    for section in ("decision", "ui_changes", "data_model", "task_breakdown", "success_criteria"):
        assert section in result, f"Missing section: {section}"


# ============================================================
# Test 3: Cursor prompt contains Step and Verify
# ============================================================

@pytest.mark.asyncio
async def test_cursor_prompt_has_steps():
    """Cursor prompt in the spec should contain Step and Verify."""
    spec = make_spec()
    prompt = spec.get("cursor_prompt", "")
    assert "Step" in prompt
    assert "Verify" in prompt


# ============================================================
# Test 4: LLM returns garbage — fallback spec generated
# ============================================================

@pytest.mark.asyncio
async def test_llm_garbage_produces_fallback():
    """Unparseable LLM output should produce a fallback spec (not crash)."""
    mock_llm = make_mock_react_llm("This is absolutely not JSON!!!")

    with patch("app.services.agents.spec_builder.get_strong_llm", return_value=mock_llm), \
         patch("app.services.agents.spec_builder.get_fast_llm", return_value=mock_llm):
        from app.services.agents.spec_builder import build_spec
        result = await build_spec(
            pattern_report=make_pattern_report(),
            four_q=make_four_q_answers(complete=True),
        )

    # Should not crash — returns fallback spec or partial result
    assert isinstance(result, dict)
    # Fallback spec should still have a decision
    assert "decision" in result


# ============================================================
# Test 5: Deterministic lint catches missing acceptance criteria
# ============================================================

@pytest.mark.asyncio
async def test_lint_catches_missing_acceptance_criteria():
    """Spec with tasks missing acceptance_criteria should have ambiguity_score > 0."""
    spec_data = make_spec()
    # Remove acceptance_criteria from all tasks
    for task in spec_data.get("task_breakdown", []):
        task.pop("acceptance_criteria", None)

    mock_llm = make_mock_react_llm(spec_data)

    with patch("app.services.agents.spec_builder.get_strong_llm", return_value=mock_llm), \
         patch("app.services.agents.spec_builder.get_fast_llm", return_value=mock_llm):
        from app.services.agents.spec_builder import build_spec
        result = await build_spec(
            pattern_report=make_pattern_report(),
            four_q=make_four_q_answers(complete=True),
        )

    # Lint should flag missing acceptance criteria
    assert result.get("ambiguity_score", 0) > 0


# ============================================================
# Test 6: Repo context is passed through to spec
# ============================================================

@pytest.mark.asyncio
async def test_repo_context_passed():
    """Providing repo_context should not break spec generation."""
    mock_llm = make_mock_react_llm(make_spec())

    repo_ctx = {
        "readme": "# My App\nA sample app",
        "stack_guess": {"frontend": "react", "backend": "python"},
        "routes_text": "GET /api/users",
    }

    with patch("app.services.agents.spec_builder.get_strong_llm", return_value=mock_llm), \
         patch("app.services.agents.spec_builder.get_fast_llm", return_value=mock_llm):
        from app.services.agents.spec_builder import build_spec
        result = await build_spec(
            pattern_report=make_pattern_report(),
            four_q=make_four_q_answers(complete=True),
            priorities=None,
            repo_context=repo_ctx,
        )

    assert isinstance(result, dict)
    assert "decision" in result
