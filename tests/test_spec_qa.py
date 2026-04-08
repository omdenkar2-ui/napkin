"""Tests for the Spec QA / Ambiguity Killer agent (Agent 6)."""

from __future__ import annotations

import pytest

from tests.conftest import make_four_q_answers, make_spec


# ============================================================
# Test 1: Clean spec → passed=True
# ============================================================

@pytest.mark.asyncio
async def test_clean_spec_passes():
    """A well-formed spec should pass QA with no errors."""
    from app.services.agents.spec_qa import run_spec_qa

    spec = make_spec()
    result = await run_spec_qa(spec, make_four_q_answers(), llm=None)

    assert result["error_count"] == 0
    assert result["passed"] is True


# ============================================================
# Test 2: Missing acceptance criteria → error
# ============================================================

@pytest.mark.asyncio
async def test_missing_acceptance_criteria():
    """Tasks without acceptance_criteria should produce errors."""
    from app.services.agents.spec_qa import run_spec_qa

    spec = make_spec()
    for task in spec["task_breakdown"]:
        task.pop("acceptance_criteria", None)
        task.pop("acceptance", None)

    result = await run_spec_qa(spec, make_four_q_answers(), llm=None)

    assert result["error_count"] >= 1
    assert result["passed"] is False
    # Check that the right category was flagged
    categories = {i["category"] for i in result["issues"] if i["severity"] == "error"}
    assert "completeness" in categories


# ============================================================
# Test 3: Banned words in cursor_prompt → error
# ============================================================

@pytest.mark.asyncio
async def test_banned_words_error():
    """Cursor prompt with banned words should produce errors."""
    from app.services.agents.spec_qa import run_spec_qa

    spec = make_spec()
    spec["cursor_prompt"] = "Step 1: improve the dashboard. Step 2: optimize queries."

    result = await run_spec_qa(spec, make_four_q_answers(), llm=None)

    assert result["error_count"] >= 1
    assert result["passed"] is False
    banned_issues = [
        i for i in result["issues"]
        if "vague words" in i.get("message", "").lower()
    ]
    assert len(banned_issues) >= 1


# ============================================================
# Test 4: Generates clarification questions from errors
# ============================================================

@pytest.mark.asyncio
async def test_clarification_questions():
    """Error-level issues should generate clarification questions."""
    from app.services.agents.spec_qa import run_spec_qa

    spec = make_spec()
    spec.pop("decision")  # Remove required section

    result = await run_spec_qa(spec, make_four_q_answers(), llm=None)

    assert result["error_count"] >= 1
    assert len(result.get("clarification_questions", [])) >= 1
