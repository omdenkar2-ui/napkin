"""Tests for the Spec Builder agent (Agent 4)."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from tests.conftest import make_four_q_answers, make_mock_react_llm, make_pattern_report, make_spec


# ============================================================
# Test 1: Full generation → valid 6-section spec
# ============================================================

@pytest.mark.asyncio
async def test_full_spec_generation():
    """Complete inputs should produce a 6-section spec with cursor_prompt."""
    mock_llm = make_mock_react_llm(make_spec())

    with patch("app.services.agents.mvp.spec_builder.get_strong_llm", return_value=mock_llm):
        from app.services.agents.mvp.spec_builder import spec_builder_node
        state = {
            "pattern_report": make_pattern_report(),
            "four_q_answers": make_four_q_answers(complete=True),
            "repo_snapshot": {},
            "messages": [],
            "retry_count": 0,
        }
        result = await spec_builder_node(state)

    spec = result.get("spec_object")
    assert spec is not None
    assert "decision" in spec
    assert "task_breakdown" in spec
    assert "cursor_prompt" in spec


# ============================================================
# Test 2: Missing pattern report → error
# ============================================================

@pytest.mark.asyncio
async def test_missing_pattern_report():
    """No pattern report should return an error."""
    from app.services.agents.mvp.spec_builder import spec_builder_node
    state = {
        "pattern_report": {},
        "four_q_answers": make_four_q_answers(complete=True),
        "repo_snapshot": {},
        "messages": [],
    }
    result = await spec_builder_node(state)
    assert result.get("error")


# ============================================================
# Test 3: Incomplete 4Q answers → error
# ============================================================

@pytest.mark.asyncio
async def test_incomplete_four_q():
    """Incomplete 4Q should return an error."""
    from app.services.agents.mvp.spec_builder import spec_builder_node
    state = {
        "pattern_report": make_pattern_report(),
        "four_q_answers": make_four_q_answers(complete=False),
        "repo_snapshot": {},
        "messages": [],
    }
    result = await spec_builder_node(state)
    assert result.get("error")


# ============================================================
# Test 4: LLM returns garbage → graceful handling
# ============================================================

@pytest.mark.asyncio
async def test_llm_garbage_spec():
    """Unparseable LLM output should not crash."""
    mock_llm = make_mock_react_llm("This is absolutely not JSON!!!")

    with patch("app.services.agents.mvp.spec_builder.get_strong_llm", return_value=mock_llm):
        from app.services.agents.mvp.spec_builder import spec_builder_node
        state = {
            "pattern_report": make_pattern_report(),
            "four_q_answers": make_four_q_answers(complete=True),
            "repo_snapshot": {},
            "messages": [],
            "retry_count": 0,
        }
        result = await spec_builder_node(state)

    # Should not crash — returns error or partial result
    assert isinstance(result, dict)


# ============================================================
# Test 5: Cursor prompt has steps and verify lines
# ============================================================

@pytest.mark.asyncio
async def test_cursor_prompt_has_steps():
    """Cursor prompt in the spec should contain Step and Verify."""
    spec = make_spec()
    prompt = spec.get("cursor_prompt", "")
    assert "Step" in prompt
    assert "Verify" in prompt
