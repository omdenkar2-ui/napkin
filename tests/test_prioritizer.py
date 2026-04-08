"""Tests for the Opportunity Prioritizer agent (Agent 7)."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from tests.conftest import make_mock_react_llm, make_pattern_report


def _prioritizer_result() -> dict:
    """Build a mock structured output result for prioritization."""
    return {
        "opportunities": [
            {
                "title": "Speed up dashboard",
                "description": "Optimize query and caching",
                "reach": 100,
                "impact": 2.5,
                "confidence": 0.9,
                "effort_weeks": 2,
                "risks": ["Cache invalidation complexity"],
                "source_patterns": ["Slow dashboard"],
                "segments_served": ["power-user"],
            },
            {
                "title": "Add PDF export",
                "description": "Export reports to PDF",
                "reach": 60,
                "impact": 2.0,
                "confidence": 0.8,
                "effort_weeks": 1,
                "risks": [],
                "source_patterns": ["Missing PDF export"],
                "segments_served": ["power-user"],
            },
            {
                "title": "Improve onboarding",
                "description": "Guided setup wizard",
                "reach": 40,
                "impact": 1.5,
                "confidence": 0.7,
                "effort_weeks": 3,
                "risks": ["Scope creep"],
                "source_patterns": ["Confusing onboarding"],
                "segments_served": ["new-user"],
            },
        ],
        "recommendation_reasoning": "Dashboard speed has highest RICE.",
        "tradeoff_summary": "Deferring PDF export means power users wait.",
    }


# ============================================================
# Test 1: 3 clusters → ranked opportunities by RICE
# ============================================================

@pytest.mark.asyncio
async def test_rice_ranking():
    """Opportunities should be ranked by RICE score descending."""
    mock_llm = make_mock_react_llm(_prioritizer_result())

    from app.services.agents.prioritizer import run_prioritizer
    result = await run_prioritizer(make_pattern_report(), llm=mock_llm)

    opps = result.get("opportunities", [])
    assert len(opps) >= 2
    # RICE scores should be descending
    scores = [o["rice_score"] for o in opps]
    assert scores == sorted(scores, reverse=True)
    # Ranks assigned
    assert opps[0]["rank"] == 1


# ============================================================
# Test 2: Recommendation has reasoning
# ============================================================

@pytest.mark.asyncio
async def test_recommendation_reasoning():
    """Result should include recommendation reasoning."""
    mock_llm = make_mock_react_llm(_prioritizer_result())

    from app.services.agents.prioritizer import run_prioritizer
    result = await run_prioritizer(make_pattern_report(), llm=mock_llm)

    assert result.get("recommendation_reasoning")
    assert result.get("recommended")


# ============================================================
# Test 3: Tradeoffs explained
# ============================================================

@pytest.mark.asyncio
async def test_tradeoff_summary():
    """Result should include tradeoff summary."""
    mock_llm = make_mock_react_llm(_prioritizer_result())

    from app.services.agents.prioritizer import run_prioritizer
    result = await run_prioritizer(make_pattern_report(), llm=mock_llm)

    assert result.get("tradeoff_summary")


# ============================================================
# Test 4: Empty clusters → empty result
# ============================================================

@pytest.mark.asyncio
async def test_empty_clusters():
    """No clusters should return empty result."""
    from app.services.agents.prioritizer import run_prioritizer
    result = await run_prioritizer({"clusters": []})

    assert result.get("opportunities") == []
    assert result.get("recommended") is None
