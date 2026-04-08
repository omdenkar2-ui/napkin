"""Tests for the Intake Structurer agent — extract_signals(raw_texts) -> list[dict]."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.conftest import make_feedback_texts, make_mock_react_llm


# ============================================================
# Test 1: Basic intake — 3 texts produce 3 signals
# ============================================================

@pytest.mark.asyncio
async def test_basic_intake_produces_signals():
    """3 feedback texts should produce structured signals via extract_signals."""
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

    with patch("app.services.agents.intake.get_fast_llm", return_value=mock_llm), \
         patch("app.services.agents.intake.get_embeddings"):
        from app.services.agents.intake import extract_signals
        result = await extract_signals(make_feedback_texts(3))

    # Returns list[dict] directly, not a state dict
    assert isinstance(result, list)
    assert len(result) >= 3


# ============================================================
# Test 2: Empty input returns empty list
# ============================================================

@pytest.mark.asyncio
async def test_empty_input_returns_empty_list():
    """No raw_texts should return an empty list."""
    from app.services.agents.intake import extract_signals
    result = await extract_signals([])

    assert isinstance(result, list)
    assert len(result) == 0


# ============================================================
# Test 3: Deduplication removes near-duplicates
# ============================================================

@pytest.mark.asyncio
async def test_deduplication_reduces_signals():
    """Duplicate feedback texts should be deduplicated."""
    # LLM returns 3 signals with duplicate pain/request pairs
    signals = [
        {"pain": "Slow dashboard", "request": "Make it faster", "emotion": "frustrated",
         "context": "enterprise", "jtbd_hint": "Work efficiently", "segment_guess": "power-user",
         "raw_text_snippet": "Dashboard is slow", "confidence": 0.9},
        {"pain": "Slow dashboard", "request": "Make it faster", "emotion": "frustrated",
         "context": "enterprise", "jtbd_hint": "Work efficiently", "segment_guess": "power-user",
         "raw_text_snippet": "Dashboard loads slowly", "confidence": 0.85},
        {"pain": "No PDF export", "request": "Add PDF export", "emotion": "annoyed",
         "context": "enterprise", "jtbd_hint": "Share reports", "segment_guess": "power-user",
         "raw_text_snippet": "Need PDF", "confidence": 0.8},
    ]

    mock_llm = make_mock_react_llm({"signals": signals, "count": 3})

    # Mock embeddings to simulate near-identical vectors for the first two signals
    import numpy as np
    mock_embeddings = MagicMock()
    mock_embeddings.embed_documents.return_value = [
        [1.0, 0.0, 0.0],  # signal 0
        [0.999, 0.01, 0.0],  # signal 1 — nearly identical to 0
        [0.0, 1.0, 0.0],  # signal 2 — different
    ]

    with patch("app.services.agents.intake.get_fast_llm", return_value=mock_llm), \
         patch("app.services.agents.intake.get_embeddings", return_value=mock_embeddings):
        from app.services.agents.intake import extract_signals
        result = await extract_signals(["Dashboard is slow", "Dashboard loads slowly", "Need PDF"])

    # Dedup should remove one of the near-duplicate signals
    assert isinstance(result, list)
    assert len(result) < 3


# ============================================================
# Test 4: LLM returns garbage — graceful fallback
# ============================================================

@pytest.mark.asyncio
async def test_llm_error_returns_fallback():
    """If LLM raises an exception, should produce raw fallback signals."""
    mock_llm = MagicMock()
    structured_mock = MagicMock()
    structured_mock.ainvoke = AsyncMock(side_effect=Exception("LLM parse error"))
    mock_llm.with_structured_output.return_value = structured_mock

    with patch("app.services.agents.intake.get_fast_llm", return_value=mock_llm):
        from app.services.agents.intake import extract_signals
        result = await extract_signals(["Some feedback"])

    # Should not crash — returns fallback signals (one per input text)
    assert isinstance(result, list)
    assert len(result) >= 1
    # Fallback signals have low confidence
    assert result[0].get("confidence", 1.0) <= 0.5


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

    with patch("app.services.agents.intake.get_fast_llm", return_value=mock_llm), \
         patch("app.services.agents.intake.get_embeddings"):
        from app.services.agents.intake import extract_signals
        result = await extract_signals([f"Feedback text {i}" for i in range(10)])

    assert isinstance(result, list)
    assert len(result) >= 1
    # Each signal should have a feedback_item_id assigned
    for signal in result:
        assert "feedback_item_id" in signal
