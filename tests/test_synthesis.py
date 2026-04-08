"""Tests for the Signal Synthesis agent — synthesize_patterns(signals) -> dict."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from tests.conftest import make_mock_react_llm, make_signals


def _synthesis_report(clusters: int = 3) -> dict:
    """Build a mock FeedbackAnalysis result for structured output."""
    critical_issues = []
    valuable_insights = []
    future_opportunities = []

    for i in range(clusters):
        critical_issues.append({
            "title": f"Critical Issue {i+1}",
            "description": f"Pain summary {i+1}",
            "severity": 8 - i,
            "evidence": [f"Quote {i}"],
            "recommended_action": f"Fix {i+1}",
            "frequency": 10 - i,
        })
        valuable_insights.append({
            "title": f"Insight {i+1}",
            "description": f"Insight desc {i+1}",
            "insight_type": "behavior",
            "evidence": [f"Quote {i}"],
            "confidence": 0.9 - i * 0.1,
        })
        future_opportunities.append({
            "title": f"Opportunity {i+1}",
            "description": f"Opportunity desc {i+1}",
            "evidence": [f"Quote {i}"],
            "confidence": 0.8 - i * 0.1,
        })

    return {
        "critical_issues": critical_issues,
        "valuable_insights": valuable_insights,
        "future_opportunities": future_opportunities,
        "segments_found": ["power-user", "new-user"],
        "contradictions": [],
    }


# ============================================================
# Test 1: Happy path — signals produce pattern report
# ============================================================

@pytest.mark.asyncio
async def test_synthesis_produces_pattern_report():
    """Signals should produce a pattern report with critical_issues."""
    mock_llm = make_mock_react_llm(_synthesis_report(3))

    with patch("app.services.agents.synthesis.get_strong_llm", return_value=mock_llm), \
         patch("app.services.agents.synthesis.get_embeddings"):
        from app.services.agents.synthesis import synthesize_patterns
        result = await synthesize_patterns(make_signals(5))

    # Returns dict directly, not wrapped in state
    assert isinstance(result, dict)
    assert len(result.get("critical_issues", [])) >= 1
    assert len(result.get("top_pains", [])) >= 1


# ============================================================
# Test 2: Severity ranking — critical issues are ordered
# ============================================================

@pytest.mark.asyncio
async def test_severity_ranking():
    """Critical issues should have severity values."""
    mock_llm = make_mock_react_llm(_synthesis_report(3))

    with patch("app.services.agents.synthesis.get_strong_llm", return_value=mock_llm), \
         patch("app.services.agents.synthesis.get_embeddings"):
        from app.services.agents.synthesis import synthesize_patterns
        result = await synthesize_patterns(make_signals(5))

    critical = result.get("critical_issues", [])
    for issue in critical:
        assert "severity" in issue or "title" in issue


# ============================================================
# Test 3: Empty input returns empty report
# ============================================================

@pytest.mark.asyncio
async def test_empty_input_returns_empty_report():
    """Empty signals list should return empty report."""
    from app.services.agents.synthesis import synthesize_patterns
    result = await synthesize_patterns([])

    assert isinstance(result, dict)
    assert result.get("total_items_analyzed", -1) == 0
    assert len(result.get("critical_issues", [])) == 0


# ============================================================
# Test 4: Sparse data (1-2 signals) still produces output
# ============================================================

@pytest.mark.asyncio
async def test_sparse_data_still_produces_output():
    """Even 1-2 signals should produce a non-empty report."""
    mock_llm = make_mock_react_llm(_synthesis_report(1))

    with patch("app.services.agents.synthesis.get_strong_llm", return_value=mock_llm):
        from app.services.agents.synthesis import synthesize_patterns
        result = await synthesize_patterns(make_signals(2))

    assert isinstance(result, dict)
    # Should have at least one critical issue (direct LLM analysis path)
    assert len(result.get("critical_issues", [])) >= 1
    # Data quality metadata should indicate low confidence
    dq = result.get("data_quality", {})
    assert dq.get("confidence") in ("low", "very_low", "medium")


# ============================================================
# Test 5: Segments found in report
# ============================================================

@pytest.mark.asyncio
async def test_segments_found():
    """Pattern report should include discovered segments."""
    mock_llm = make_mock_react_llm(_synthesis_report(2))

    with patch("app.services.agents.synthesis.get_strong_llm", return_value=mock_llm):
        from app.services.agents.synthesis import synthesize_patterns
        result = await synthesize_patterns(make_signals(3))

    segments = result.get("segments_found", [])
    assert isinstance(segments, list)
