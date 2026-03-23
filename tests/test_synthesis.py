"""Tests for the Signal Synthesis agent (Agent 2)."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from tests.conftest import make_mock_react_llm, make_signals


def _synthesis_report(clusters: int = 3) -> dict:
    """Build a mock synthesis report."""
    cluster_list = []
    for i in range(clusters):
        cluster_list.append({
            "id": f"c{i+1}",
            "label": f"Theme {i+1}",
            "pain_summary": f"Pain summary {i+1}",
            "frequency": 10 - i,
            "severity": 8.0 - i,
            "confidence": 0.9 - i * 0.1,
            "urgency": "high" if i == 0 else "medium",
            "evidence_quotes": [{"text": f"Quote {i}", "signal_id": f"sig-{i}"}],
            "signal_ids": [f"sig-{i}", f"sig-{i+1}"],
        })
    return {
        "clusters": cluster_list,
        "top_pains": [c["label"] for c in cluster_list],
        "segments_found": ["power-user", "new-user"],
        "contradictions": [],
        "total_signals_analyzed": 10,
        "confidence_summary": "High confidence.",
    }


# ============================================================
# Test 1: Happy path — signals produce clusters
# ============================================================

@pytest.mark.asyncio
async def test_synthesis_produces_clusters():
    """10 signals should produce a pattern report with clusters."""
    mock_llm = make_mock_react_llm(_synthesis_report(3))

    with patch("app.services.agents.mvp.synthesis.get_strong_llm", return_value=mock_llm):
        from app.services.agents.mvp.synthesis import signal_synthesis_node
        state = {"feedback_items": make_signals(5), "messages": []}
        result = await signal_synthesis_node(state)

    report = result.get("pattern_report", {})
    assert len(report.get("clusters", [])) == 3
    assert len(report.get("top_pains", [])) >= 1


# ============================================================
# Test 2: Too few items asks for more
# ============================================================

@pytest.mark.asyncio
async def test_too_few_items_asks_for_more():
    """Less than 2 items should prompt for more feedback."""
    from app.services.agents.mvp.synthesis import signal_synthesis_node
    state = {"feedback_items": [{"id": "one"}], "messages": []}
    result = await signal_synthesis_node(state)

    assert result.get("pending_questions")
    assert "pattern_report" not in result


# ============================================================
# Test 3: Evidence quotes present in every cluster
# ============================================================

@pytest.mark.asyncio
async def test_evidence_quotes_on_clusters():
    """Every cluster should have at least 1 evidence quote."""
    mock_llm = make_mock_react_llm(_synthesis_report(3))

    with patch("app.services.agents.mvp.synthesis.get_strong_llm", return_value=mock_llm):
        from app.services.agents.mvp.synthesis import signal_synthesis_node
        state = {"feedback_items": make_signals(5), "messages": []}
        result = await signal_synthesis_node(state)

    clusters = result.get("pattern_report", {}).get("clusters", [])
    for cluster in clusters:
        assert len(cluster.get("evidence_quotes", [])) >= 1


# ============================================================
# Test 4: Top pains are populated
# ============================================================

@pytest.mark.asyncio
async def test_top_pains_populated():
    """Pattern report should have top_pains list."""
    mock_llm = make_mock_react_llm(_synthesis_report(2))

    with patch("app.services.agents.mvp.synthesis.get_strong_llm", return_value=mock_llm):
        from app.services.agents.mvp.synthesis import signal_synthesis_node
        state = {"feedback_items": make_signals(5), "messages": []}
        result = await signal_synthesis_node(state)

    top_pains = result.get("pattern_report", {}).get("top_pains", [])
    assert len(top_pains) >= 1


# ============================================================
# Test 5: Segments found in report
# ============================================================

@pytest.mark.asyncio
async def test_segments_found():
    """Pattern report should include discovered segments."""
    mock_llm = make_mock_react_llm(_synthesis_report(2))

    with patch("app.services.agents.mvp.synthesis.get_strong_llm", return_value=mock_llm):
        from app.services.agents.mvp.synthesis import signal_synthesis_node
        state = {"feedback_items": make_signals(5), "messages": []}
        result = await signal_synthesis_node(state)

    segments = result.get("pattern_report", {}).get("segments_found", [])
    assert len(segments) >= 1
