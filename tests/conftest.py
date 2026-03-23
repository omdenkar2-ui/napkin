"""Shared test fixtures for the Napkin test suite."""

from __future__ import annotations

import json
import os
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest

# --- Ensure env vars are set before any app imports ---
os.environ.setdefault("APP_SECRET_KEY", "test-secret-key-for-testing")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")


# ============================================================
# API Test Constants & Fixtures
# ============================================================

MOCK_USER = {
    "id": "00000000-0000-0000-0000-000000000001",
    "org_id": "org-1",
    "role": "member",
    "email": "test@example.com",
}
MOCK_USER_ID = UUID("00000000-0000-0000-0000-000000000001")
MOCK_SESSION_ID = UUID("00000000-0000-0000-0000-000000000099")
MOCK_PROJECT_ID = UUID("00000000-0000-0000-0000-000000000050")


def make_mock_supabase_db(
    session_data: dict | None = None,
    project_data: dict | None = None,
) -> MagicMock:
    """Create a mock Supabase admin client with chained query support."""
    db = MagicMock()

    # Default session data for _verify_session_access
    if session_data is None:
        session_data = {
            "id": str(MOCK_SESSION_ID),
            "projects": {"org_id": "org-1"},
        }

    # Default project data for create_session / list_sessions
    if project_data is None:
        project_data = {"org_id": "org-1"}

    def _table(name: str) -> MagicMock:
        chain = MagicMock()
        if name == "sessions":
            chain.select.return_value = chain
            chain.eq.return_value = chain
            chain.single.return_value = chain
            result = MagicMock()
            result.data = session_data
            chain.execute.return_value = result
        elif name == "projects":
            chain.select.return_value = chain
            chain.eq.return_value = chain
            chain.single.return_value = chain
            result = MagicMock()
            result.data = project_data
            chain.execute.return_value = result
        else:
            chain.select.return_value = chain
            chain.eq.return_value = chain
            chain.single.return_value = chain
            chain.order.return_value = chain
            chain.range.return_value = chain
            result = MagicMock()
            result.data = []
            chain.execute.return_value = result
        return chain

    db.table.side_effect = _table
    return db


# ============================================================
# Mock LLM
# ============================================================

def make_mock_llm(response_content: str) -> AsyncMock:
    """Create a mock LLM that returns a fixed response."""
    mock = AsyncMock()
    response = MagicMock()
    response.content = response_content
    mock.ainvoke.return_value = response
    return mock


def make_mock_llm_from_dict(data: dict) -> AsyncMock:
    """Create a mock LLM that returns a JSON-serialized dict."""
    return make_mock_llm(json.dumps(data, default=str))


def make_mock_react_llm(result: dict | list | str) -> MagicMock:
    """Create a mock LLM supporting bind_tools + with_structured_output.

    - bind_tools() returns mock whose ainvoke returns AIMessage with tool_calls=[]
      (LLM decides not to use tools -> ReAct loop exits on first iteration)
    - with_structured_output() returns mock whose ainvoke returns result directly
    - Direct ainvoke() returns MagicMock with .content = JSON string

    Uses MagicMock as the base so sync methods (bind_tools, with_structured_output)
    don't accidentally become coroutines. Only ainvoke is async.
    """
    mock = MagicMock()

    content = json.dumps(result, default=str) if isinstance(result, (dict, list)) else str(result)

    # bind_tools -> returns mock with async ainvoke that has no tool calls
    bound_mock = MagicMock()
    ai_msg = MagicMock()
    ai_msg.content = content
    ai_msg.tool_calls = []
    bound_mock.ainvoke = AsyncMock(return_value=ai_msg)
    mock.bind_tools.return_value = bound_mock

    # with_structured_output -> returns mock with async ainvoke that returns result
    structured_mock = MagicMock()
    structured_mock.ainvoke = AsyncMock(return_value=result)
    mock.with_structured_output.return_value = structured_mock

    # Direct ainvoke fallback (cursor prompt, answer processing, etc.)
    response = MagicMock()
    response.content = content
    response.tool_calls = []
    mock.ainvoke = AsyncMock(return_value=response)

    return mock


# ============================================================
# Sample Data Factories
# ============================================================

def make_feedback_texts(count: int = 5) -> list[str]:
    """Generate sample customer feedback texts."""
    texts = [
        "The dashboard is so slow, it takes 8 seconds to load. Very frustrating.",
        "I really need PDF export for our monthly reports. Can't share with stakeholders.",
        "The onboarding flow is confusing. I gave up after 10 minutes.",
        "Search is broken - half the time it returns no results even for exact matches.",
        "Love the product but dark mode would be amazing for late night work.",
        "API rate limits are too aggressive. We hit them doing normal batch operations.",
        "Mobile app crashes whenever I try to upload an image larger than 5MB.",
    ]
    return texts[:count]


def make_signals(count: int = 5) -> list[dict]:
    """Generate sample extracted signals."""
    return [
        {
            "id": f"sig-{i}",
            "raw_text": text,
            "pain": f"Pain point {i}",
            "request": f"Request {i}",
            "context": "enterprise",
            "emotion": "frustrated",
            "jtbd_hint": "Complete their work efficiently",
            "segment_guess": "power-user" if i % 2 == 0 else "new-user",
            "source_label": f"source-{i % 3}",
            "confidence": 0.8,
        }
        for i, text in enumerate(make_feedback_texts(count))
    ]


def make_pattern_report() -> dict:
    """Generate a sample pattern report with 3 clusters."""
    return {
        "clusters": [
            {
                "id": "c1",
                "label": "Slow dashboard",
                "pain_summary": "Dashboard takes 8s to load",
                "frequency": 15,
                "severity": 8.0,
                "confidence": 0.9,
                "urgency": "high",
                "evidence_quotes": [{"text": "It's so slow", "signal_id": "s1"}],
                "signal_ids": ["s1", "s2", "s3"],
            },
            {
                "id": "c2",
                "label": "Missing PDF export",
                "pain_summary": "Users can't export reports as PDF",
                "frequency": 10,
                "severity": 6.0,
                "confidence": 0.8,
                "urgency": "medium",
                "evidence_quotes": [{"text": "Need PDF", "signal_id": "s4"}],
                "signal_ids": ["s4", "s5"],
            },
            {
                "id": "c3",
                "label": "Confusing onboarding",
                "pain_summary": "New users can't figure out the setup flow",
                "frequency": 8,
                "severity": 7.0,
                "confidence": 0.7,
                "urgency": "high",
                "evidence_quotes": [{"text": "I gave up", "signal_id": "s6"}],
                "signal_ids": ["s6", "s7"],
            },
        ],
        "top_pains": ["Slow dashboard", "Missing PDF export", "Confusing onboarding"],
        "segments_found": ["power-user", "new-user"],
        "contradictions": [],
        "total_signals_analyzed": 10,
        "confidence_summary": "High confidence across all clusters.",
    }


def make_four_q_answers(complete: bool = True) -> dict:
    """Generate sample 4Q answers."""
    answers: dict = {
        "q1_segment_jtbd": "Power users who need fast reporting",
        "q1_evidence": ["sig-1", "sig-2"],
    }
    if complete:
        answers.update({
            "q2_smallest_proof": "PDF export button on reports page",
            "q2_scope_notes": "Single-page PDF only",
            "q3_non_goals": ["Dashboard redesign", "Mobile app"],
            "q4_constraints": ["React frontend", "Supabase backend"],
            "q4_risks": ["PDF generation library compatibility"],
            "q4_dependencies": [],
            "is_complete": True,
        })
    return answers


def make_spec() -> dict:
    """Generate a well-formed 6-section spec."""
    return {
        "decision": {
            "what": "Add PDF export to reports",
            "why": "Most requested feature",
            "evidence_refs": ["cluster-1"],
            "segment": "power-user",
        },
        "ui_changes": [
            {
                "screen": "Reports",
                "component": "ExportButton",
                "description": "Add export button",
            },
        ],
        "data_model": [
            {
                "entity": "export_job",
                "action": "create",
                "fields": ["id", "user_id", "status", "file_url"],
                "migration_notes": "New table",
            },
        ],
        "task_breakdown": [
            {
                "title": "Create export_job table",
                "description": "Add migration for export tracking",
                "type": "DB",
                "estimate_hours": 2.0,
                "dependencies": [],
                "acceptance_criteria": ["Table exists with correct schema"],
            },
            {
                "title": "Build ExportButton component",
                "description": "React component with PDF trigger",
                "type": "FE",
                "estimate_hours": 4.0,
                "dependencies": ["Create export_job table"],
                "acceptance_criteria": ["Button renders", "Triggers export API"],
            },
            {
                "title": "Build export API endpoint",
                "description": "POST /api/exports to create export job",
                "type": "BE",
                "estimate_hours": 3.0,
                "dependencies": ["Create export_job table"],
                "acceptance_criteria": ["Endpoint returns 200", "Job persisted"],
            },
        ],
        "success_criteria": [
            {
                "name": "Export usage",
                "target": ">100 exports/week",
                "timeframe": "2 weeks",
            },
        ],
        "cursor_prompt": (
            "Step 1: Create export_job migration. "
            "Verify: Run migration and check table exists. "
            "Step 2: Add ExportButton to Reports page. "
            "Verify: Button renders correctly."
        ),
    }


def make_repo_files() -> dict[str, str]:
    """Generate sample repo files for Agent 5."""
    return {
        "package.json": '{"dependencies": {"react": "^18.2.0", "next": "^14.0.0"}}',
        "src/models/user.ts": "export interface User { id: string; name: string; }",
        "src/routes/api.ts": "router.get('/users', getUsers)",
        "src/auth/middleware.ts": "export function verifyJWT(token: string) {}",
        "README.md": "# My App\nA sample application.",
    }
