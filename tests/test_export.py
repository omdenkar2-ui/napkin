"""Tests for the Export Layer (tickets, PRD, export service)."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from app.services.export.tickets_exporter import (
    _effort_to_tshirt,
    _priority_to_jira,
    _priority_to_linear_int,
    _rice_to_priority,
    export_tickets,
)
from app.services.export.prd_exporter import export_prd
from app.services.export.export_service import run_export, _prepare_export_state


def _make_state(**overrides) -> dict:
    """Minimal valid state using export field names directly."""
    base = {
        "session_id": "test-session-123",
        "feedback_items": [
            {"id": "f1", "source": "intercom", "severity": "high", "sentiment": "negative"},
        ],
        "pattern_cards": [
            {
                "pattern_id": "p1",
                "name": "Slow dashboard loading",
                "description": "Users report the dashboard takes too long to load",
                "confidence": 0.87,
                "source_item_ids": ["f1", "f2", "f3"],
            },
        ],
        "prioritized_features": [
            {
                "pattern_id": "p1",
                "rice_score": 90,
                "effort_weeks": 2,
            },
        ],
        "spec": {"features": []},
    }
    base.update(overrides)
    return base


def _make_napkin_state(**overrides) -> dict:
    """State shaped like real NapkinState (orchestrator field names)."""
    base = {
        "session_id": "test-session-456",
        "feedback_items": [
            {"id": "f1", "source": "intercom", "severity": "high", "emotion": "frustrated"},
        ],
        "pattern_report": {
            "clusters": [
                {
                    "id": "c1",
                    "label": "Dashboard performance",
                    "pain_summary": "Dashboard loads too slowly for power users",
                    "confidence": 0.85,
                    "signal_ids": ["s1", "s2", "s3"],
                    "severity_score": 8.0,
                    "frequency": 15,
                },
            ],
            "top_pains": ["Dashboard performance"],
            "segments_found": ["power-user"],
        },
        "prioritization_result": {
            "opportunities": [
                {
                    "id": "op1",
                    "title": "Optimize dashboard queries",
                    "source_patterns": ["c1"],
                    "rice_score": 85,
                    "effort_weeks": 1.5,
                    "reach": 500,
                    "impact": 2.0,
                    "confidence": 0.85,
                },
            ],
            "recommended": "op1",
        },
        "spec_object": {
            "decision": {"what": "Dashboard optimization", "why": "Users need speed"},
            "task_breakdown": [
                {
                    "title": "Add query caching",
                    "description": "Cache dashboard queries with 5min TTL",
                    "type": "BE",
                    "acceptance_criteria": ["P95 latency < 200ms"],
                },
            ],
            "cursor_prompt": "Build a query caching layer for the dashboard.",
        },
        "messages": [],
        "stage_history": [],
    }
    base.update(overrides)
    return base


# ============================================================
# Test 1: export_tickets returns one ticket per prioritized feature
# ============================================================

def test_export_tickets_one_per_feature():
    """export_tickets should return one ticket per prioritized feature."""
    state = _make_state()
    tickets = export_tickets(state)

    assert len(tickets) == 1
    assert tickets[0]["title"] == "Slow dashboard loading"
    assert tickets[0]["source_feedback_count"] == 3
    assert "linear_compatible" in tickets[0]
    assert "jira_compatible" in tickets[0]


# ============================================================
# Test 2: export_tickets returns empty list when no features
# ============================================================

def test_export_tickets_empty_when_no_features():
    """export_tickets should return empty list when prioritized_features is empty."""
    state = _make_state(prioritized_features=[])
    tickets = export_tickets(state)

    assert tickets == []


# ============================================================
# Test 3: RICE score 90 → priority "urgent"
# ============================================================

def test_rice_90_is_urgent():
    """RICE score 90 should map to priority 'urgent'."""
    assert _rice_to_priority(90) == "urgent"


# ============================================================
# Test 4: RICE score 30 → priority "medium"
# ============================================================

def test_rice_30_is_medium():
    """RICE score 30 should map to priority 'medium'."""
    assert _rice_to_priority(30) == "medium"


# ============================================================
# Test 5: effort_weeks 1.5 → t-shirt size "M"
# ============================================================

def test_effort_1_5_is_medium():
    """effort_weeks 1.5 should map to t-shirt size 'M'."""
    assert _effort_to_tshirt(1.5) == "M"


# ============================================================
# Test 6: Linear priority for "urgent" is int 1
# ============================================================

def test_linear_priority_urgent_is_1():
    """Linear priority for 'urgent' should be integer 1."""
    assert _priority_to_linear_int("urgent") == 1


# ============================================================
# Test 7: Jira priority for "high" is string "High"
# ============================================================

def test_jira_priority_high():
    """Jira priority for 'high' should be string 'High'."""
    assert _priority_to_jira("high") == "High"


# ============================================================
# Test 8: export_prd returns bytes (non-empty) for minimal valid state
# ============================================================

def test_export_prd_returns_bytes():
    """export_prd should return non-empty bytes for a minimal valid state."""
    state = _make_state()
    pdf_bytes = export_prd(state)

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 100
    assert pdf_bytes[:5] == b"%PDF-"


# ============================================================
# Test 9: export_prd does not raise when optional fields are missing
# ============================================================

def test_export_prd_missing_fields():
    """export_prd should not raise when optional fields are missing."""
    state = {"session_id": "bare-minimum"}
    pdf_bytes = export_prd(state)

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 0


# ============================================================
# Test 10: run_export populates exports dict even when PDF upload fails
# ============================================================

@pytest.mark.asyncio
async def test_run_export_populates_exports():
    """run_export should populate exports with tickets, exported_at, and errors."""
    state = _make_state()

    with patch(
        "app.services.export.export_service._upload_pdf",
        return_value="https://fake-url.com/prd.pdf",
    ):
        result = await run_export(state)

    exports = result.get("exports", {})
    assert "tickets" in exports
    assert len(exports["tickets"]) == 1
    assert "exported_at" in exports
    assert isinstance(exports["errors"], list)
    assert exports["prd_url"] == "https://fake-url.com/prd.pdf"
    assert result["stage"] == "done"
    assert result["is_complete"] is True


# ============================================================
# Test 11: _prepare_export_state maps NapkinState field names
# ============================================================

def test_prepare_export_state_maps_napkin_fields():
    """_prepare_export_state should map pattern_report → pattern_cards, etc."""
    state = _make_napkin_state()
    mapped = _prepare_export_state(state)

    # pattern_report.clusters → pattern_cards
    assert len(mapped["pattern_cards"]) == 1
    card = mapped["pattern_cards"][0]
    assert card["pattern_id"] == "c1"
    assert card["name"] == "Dashboard performance"
    assert card["confidence"] == 0.85
    assert len(card["source_item_ids"]) == 3

    # prioritization_result.opportunities → prioritized_features
    assert len(mapped["prioritized_features"]) == 1
    feat = mapped["prioritized_features"][0]
    assert feat["pattern_id"] == "c1"  # linked via source_patterns
    assert feat["rice_score"] == 85
    assert feat["effort_weeks"] == 1.5

    # spec_object → spec
    assert len(mapped["spec"]["features"]) == 1
    assert mapped["spec"]["features"][0]["title"] == "Add query caching"

    # cursor_prompt extracted from spec_object
    assert mapped["cursor_prompt"] == "Build a query caching layer for the dashboard."


# ============================================================
# Test 12: run_export works with real NapkinState field names
# ============================================================

@pytest.mark.asyncio
async def test_run_export_with_napkin_state():
    """run_export should work when given NapkinState-shaped data (auto-mapping)."""
    state = _make_napkin_state()

    with patch(
        "app.services.export.export_service._upload_pdf",
        return_value=None,
    ):
        result = await run_export(state)

    exports = result.get("exports", {})
    assert len(exports["tickets"]) == 1
    assert exports["tickets"][0]["rice_score"] == 85
    assert exports["cursor_prompt"] == "Build a query caching layer for the dashboard."
    assert result["stage"] == "done"
    assert result["is_complete"] is True


# ============================================================
# Test 13: Passthrough when export field names already present
# ============================================================

def test_prepare_export_state_passthrough():
    """If pattern_cards/prioritized_features/spec already exist, don't overwrite."""
    state = _make_state()
    state["pattern_report"] = {"clusters": [{"id": "should_be_ignored"}]}

    mapped = _prepare_export_state(state)

    # Should keep the original pattern_cards, not map from pattern_report
    assert mapped["pattern_cards"][0]["pattern_id"] == "p1"
    assert mapped["pattern_cards"][0]["name"] == "Slow dashboard loading"
