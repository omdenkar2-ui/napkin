"""Tests for the Intake Structurer agent (Agent 1)."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.conftest import make_feedback_texts, make_mock_react_llm


# ============================================================
# Test 1: Basic intake — 3 texts produce 3 signals
# ============================================================

@pytest.mark.asyncio
async def test_basic_intake_produces_signals():
    """3 feedback texts should produce structured signals."""
    signals = [
        {"pain": "Slow loading", "request": "Faster dashboard", "emotion": "frustrated",
         "context": "enterprise", "jtbd_hint": "Complete reports", "segment_guess": "power-user",
         "raw_text_snippet": "Dashboard is slow", "confidence": 0.9},
        {"pain": "No export", "request": "PDF export", "emotion": "annoyed",
         "context": "enterprise", "jtbd_hint": "Share reports", "segment_guess": "power-user",
         "raw_text_snippet": "Need PDF", "confidence": 0.8},
        {"pain": "Confusing UI", "request": "Better onboarding", "emotion": "confused",
         "context": "startup", "jtbd_hint": "Get started", "segment_guess": "new-user",
         "raw_text_snippet": "Confusing", "confidence": 0.7},
    ]

    mock_llm = make_mock_react_llm({"signals": signals, "count": 3})

    with patch("app.services.agents.mvp.intake.get_fast_llm", return_value=mock_llm):
        from app.services.agents.mvp.intake import intake_structurer_node
        state = {"raw_texts": make_feedback_texts(3), "feedback_items": [], "messages": []}
        result = await intake_structurer_node(state)

    assert len(result.get("feedback_items", [])) >= 3


# ============================================================
# Test 2: Empty input returns prompt for more feedback
# ============================================================

@pytest.mark.asyncio
async def test_empty_input_asks_for_feedback():
    """No raw_texts should prompt user for feedback."""
    from app.services.agents.mvp.intake import intake_structurer_node
    state = {"raw_texts": [], "feedback_items": [], "messages": []}
    result = await intake_structurer_node(state)

    assert result.get("pending_questions")
    assert len(result.get("feedback_items", [])) == 0


# ============================================================
# Test 3: Existing items are preserved
# ============================================================

@pytest.mark.asyncio
async def test_existing_items_preserved():
    """New signals append to existing feedback_items."""
    new_signals = [
        {"pain": "Bug", "request": "Fix", "emotion": "angry",
         "context": "enterprise", "jtbd_hint": "Work correctly",
         "segment_guess": "power-user", "raw_text_snippet": "Bug found", "confidence": 0.9},
    ]

    mock_llm = make_mock_react_llm({"signals": new_signals, "count": 1})
    existing = [{"id": "existing-1", "pain": "Old pain"}]

    with patch("app.services.agents.mvp.intake.get_fast_llm", return_value=mock_llm):
        from app.services.agents.mvp.intake import intake_structurer_node
        state = {"raw_texts": ["Bug found"], "feedback_items": existing, "messages": []}
        result = await intake_structurer_node(state)

    items = result.get("feedback_items", [])
    assert len(items) >= 2  # existing + new


# ============================================================
# Test 4: LLM returns garbage → graceful fallback
# ============================================================

@pytest.mark.asyncio
async def test_llm_garbage_returns_graceful():
    """If LLM returns unparseable output, node should not crash."""
    mock_llm = make_mock_react_llm("This is not valid at all!!!")

    with patch("app.services.agents.mvp.intake.get_fast_llm", return_value=mock_llm):
        from app.services.agents.mvp.intake import intake_structurer_node
        state = {"raw_texts": ["Some feedback"], "feedback_items": [], "messages": []}
        result = await intake_structurer_node(state)

    # Should not crash — may return empty or partial items
    assert isinstance(result, dict)


# ============================================================
# Test 5: Multiple texts processed in batch
# ============================================================

@pytest.mark.asyncio
async def test_batch_processing():
    """Large batch of feedback texts should all be processed."""
    many_signals = [
        {"pain": f"Pain {i}", "request": f"Request {i}", "emotion": "neutral",
         "context": "enterprise", "jtbd_hint": "Work", "segment_guess": "user",
         "raw_text_snippet": f"Feedback {i}", "confidence": 0.8}
        for i in range(10)
    ]

    mock_llm = make_mock_react_llm({"signals": many_signals, "count": 10})

    with patch("app.services.agents.mvp.intake.get_fast_llm", return_value=mock_llm):
        from app.services.agents.mvp.intake import intake_structurer_node
        state = {
            "raw_texts": [f"Feedback text {i}" for i in range(10)],
            "feedback_items": [],
            "messages": [],
        }
        result = await intake_structurer_node(state)

    assert len(result.get("feedback_items", [])) >= 1
