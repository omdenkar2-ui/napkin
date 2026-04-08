"""Tests for the Sessions API endpoints."""

from __future__ import annotations

import os

os.environ.setdefault("APP_SECRET_KEY", "test-secret-key-for-testing")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")

from unittest.mock import AsyncMock, patch
from uuid import UUID

import pytest
from httpx import ASGITransport, AsyncClient

from tests.conftest import (
    MOCK_PROJECT_ID,
    MOCK_SESSION_ID,
    MOCK_USER,
    MOCK_USER_ID,
    make_mock_supabase_db,
    make_spec,
)

# Stable UUIDs for test assertions
_SID = str(MOCK_SESSION_ID)
_PID = str(MOCK_PROJECT_ID)


def _get_app():
    """Create a fresh app with auth overrides."""
    from app.api.deps.auth import get_current_user, get_current_user_id
    from app.main import create_app

    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: MOCK_USER
    app.dependency_overrides[get_current_user_id] = lambda: MOCK_USER_ID
    return app


def _mock_service(**overrides) -> AsyncMock:
    """Create a mock SessionService with configurable return values."""
    svc = AsyncMock()
    svc.create_session.return_value = overrides.get("create_session", {
        "session_id": _SID,
        "stage": "intake",
        "status": "active",
        "agent_message": "Session created.",
        "questions": [],
        "is_complete": False,
    })
    svc.process_message.return_value = overrides.get("process_message", {
        "session_id": _SID,
        "stage": "intake",
        "agent_message": "Processing feedback.",
        "questions": [],
        "is_complete": False,
        "spec_ready": False,
        "artifacts": {},
    })
    svc.get_session.return_value = overrides.get("get_session", {"id": _SID, "stage": "intake"})
    svc.get_session_spec.return_value = overrides.get("get_session_spec", None)
    svc.get_cursor_prompt.return_value = overrides.get("get_cursor_prompt", None)
    svc.get_sprint_plan.return_value = overrides.get("get_sprint_plan", None)
    svc.get_prioritization.return_value = overrides.get("get_prioritization", None)
    svc.set_repo_files.return_value = None
    svc.list_sessions.return_value = overrides.get("list_sessions", [])
    return svc


# ============================================================
# Test 1: POST /sessions — create session
# ============================================================

@pytest.mark.asyncio
async def test_create_session():
    """POST /api/v1/sessions should return 201 with session_id."""
    app = _get_app()
    mock_db = make_mock_supabase_db()
    mock_svc = _mock_service()

    with patch("app.api.routes.sessions.get_supabase_admin", return_value=mock_db), \
         patch("app.api.routes.sessions.get_session_service", return_value=mock_svc):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/v1/sessions", json={
                "project_id": _PID,
                "title": "Test session",
            })

    assert resp.status_code == 201
    data = resp.json()
    assert data["session_id"] == _SID


# ============================================================
# Test 2: POST /sessions/{id}/message — send message
# ============================================================

@pytest.mark.asyncio
async def test_send_message():
    """POST /api/v1/sessions/{id}/message should return valid response."""
    app = _get_app()
    mock_db = make_mock_supabase_db()
    mock_svc = _mock_service()

    with patch("app.api.routes.sessions.get_supabase_admin", return_value=mock_db), \
         patch("app.api.routes.sessions.get_session_service", return_value=mock_svc):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(f"/api/v1/sessions/{_SID}/message", json={
                "content": "Power users who need fast reporting",
            })

    assert resp.status_code == 200
    data = resp.json()
    assert data["session_id"] == _SID
    assert "stage" in data
    assert "agent_message" in data


# ============================================================
# Test 3: POST /sessions/{id}/feedback — add feedback
# ============================================================

@pytest.mark.asyncio
async def test_add_feedback():
    """POST /api/v1/sessions/{id}/feedback should process texts."""
    app = _get_app()
    mock_db = make_mock_supabase_db()
    mock_svc = _mock_service()

    with patch("app.api.routes.sessions.get_supabase_admin", return_value=mock_db), \
         patch("app.api.routes.sessions.get_session_service", return_value=mock_svc):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(f"/api/v1/sessions/{_SID}/feedback", json={
                "texts": ["Dashboard is slow", "Need PDF export"],
            })

    assert resp.status_code == 200
    data = resp.json()
    assert "stage" in data


# ============================================================
# Test 4: GET /sessions/{id} — get session
# ============================================================

@pytest.mark.asyncio
async def test_get_session():
    """GET /api/v1/sessions/{id} should return session dict."""
    app = _get_app()
    mock_db = make_mock_supabase_db()
    mock_svc = _mock_service()

    with patch("app.api.routes.sessions.get_supabase_admin", return_value=mock_db), \
         patch("app.api.routes.sessions.get_session_service", return_value=mock_svc):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(f"/api/v1/sessions/{_SID}")

    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == _SID


# ============================================================
# Test 5: GET /sessions/{id}/spec — 404 when no spec
# ============================================================

@pytest.mark.asyncio
async def test_get_spec_not_ready():
    """GET /api/v1/sessions/{id}/spec should 404 when no spec exists."""
    app = _get_app()
    mock_db = make_mock_supabase_db()
    mock_svc = _mock_service(get_session_spec=None)

    with patch("app.api.routes.sessions.get_supabase_admin", return_value=mock_db), \
         patch("app.api.routes.sessions.get_session_service", return_value=mock_svc):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(f"/api/v1/sessions/{_SID}/spec")

    assert resp.status_code == 404


# ============================================================
# Test 6: GET /sessions/{id}/sprint-plan — 200 with data
# ============================================================

@pytest.mark.asyncio
async def test_get_sprint_plan():
    """GET /api/v1/sessions/{id}/sprint-plan should return plan."""
    plan = {"tasks": [{"id": "t1", "title": "Task 1"}], "total_hours": 4}
    app = _get_app()
    mock_db = make_mock_supabase_db()
    mock_svc = _mock_service(get_sprint_plan=plan)

    with patch("app.api.routes.sessions.get_supabase_admin", return_value=mock_db), \
         patch("app.api.routes.sessions.get_session_service", return_value=mock_svc):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(f"/api/v1/sessions/{_SID}/sprint-plan")

    assert resp.status_code == 200
    data = resp.json()
    assert data["session_id"] == _SID
    assert "sprint_plan" in data


# ============================================================
# Test 7: GET /sessions/{id}/prioritization — 200 with data
# ============================================================

@pytest.mark.asyncio
async def test_get_prioritization():
    """GET /api/v1/sessions/{id}/prioritization should return results."""
    prio = {"opportunities": [{"id": "o1", "title": "Speed up"}], "recommended": "o1"}
    app = _get_app()
    mock_db = make_mock_supabase_db()
    mock_svc = _mock_service(get_prioritization=prio)

    with patch("app.api.routes.sessions.get_supabase_admin", return_value=mock_db), \
         patch("app.api.routes.sessions.get_session_service", return_value=mock_svc):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(f"/api/v1/sessions/{_SID}/prioritization")

    assert resp.status_code == 200
    data = resp.json()
    assert data["session_id"] == _SID
    assert "prioritization" in data


# ============================================================
# Test 8: POST /sessions/{id}/repo-files — upload files
# ============================================================

@pytest.mark.asyncio
async def test_upload_repo_files():
    """POST /api/v1/sessions/{id}/repo-files should accept file map."""
    app = _get_app()
    mock_db = make_mock_supabase_db()
    mock_svc = _mock_service()

    with patch("app.api.routes.sessions.get_supabase_admin", return_value=mock_db), \
         patch("app.api.routes.sessions.get_session_service", return_value=mock_svc):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(f"/api/v1/sessions/{_SID}/repo-files", json={
                "files": {
                    "package.json": '{"dependencies": {"react": "^18"}}',
                    "src/app.ts": "console.log('hello')",
                },
            })

    assert resp.status_code == 200
    data = resp.json()
    assert data["files_received"] == 2


# ============================================================
# Test 9: POST /sessions/{id}/repo-files — bad body → 400
# ============================================================

@pytest.mark.asyncio
async def test_upload_repo_files_bad_body():
    """POST /api/v1/sessions/{id}/repo-files with no files should 400."""
    app = _get_app()
    mock_db = make_mock_supabase_db()
    mock_svc = _mock_service()

    with patch("app.api.routes.sessions.get_supabase_admin", return_value=mock_db), \
         patch("app.api.routes.sessions.get_session_service", return_value=mock_svc):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(f"/api/v1/sessions/{_SID}/repo-files", json={
                "not_files": "wrong",
            })

    assert resp.status_code in (400, 422)


# ============================================================
# Test 10: GET /sessions — list sessions
# ============================================================

@pytest.mark.asyncio
async def test_list_sessions():
    """GET /api/v1/sessions?project_id=... should return list."""
    app = _get_app()
    mock_db = make_mock_supabase_db()
    mock_svc = _mock_service(list_sessions=[
        {"id": _SID, "stage": "intake", "title": "Session 1"},
    ])

    with patch("app.api.routes.sessions.get_supabase_admin", return_value=mock_db), \
         patch("app.api.routes.sessions.get_session_service", return_value=mock_svc):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(f"/api/v1/sessions?project_id={_PID}")

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


# ============================================================
# Test 11: GET /sessions/{id}/exports — 200 with data
# ============================================================

@pytest.mark.asyncio
async def test_get_exports():
    """GET /api/v1/sessions/{id}/exports should return exports dict."""
    exports_data = {
        "tickets": [{"title": "Fix slow dashboard", "priority": "urgent"}],
        "ticket_count": 1,
        "prd_url": "https://fake.com/prd.pdf",
        "exported_at": "2025-01-01T00:00:00",
        "errors": [],
    }
    app = _get_app()
    mock_db = make_mock_supabase_db()
    mock_svc = _mock_service(get_session={
        "id": _SID, "stage": "done", "gate_results": {"exports": exports_data},
    })

    with patch("app.api.routes.sessions.get_supabase_admin", return_value=mock_db), \
         patch("app.api.routes.sessions.get_session_service", return_value=mock_svc):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(f"/api/v1/sessions/{_SID}/exports")

    assert resp.status_code == 200
    data = resp.json()
    assert data["ticket_count"] == 1
    assert "exported_at" in data


# ============================================================
# Test 12: GET /sessions/{id}/exports — 404 when no exports
# ============================================================

@pytest.mark.asyncio
async def test_get_exports_not_ready():
    """GET /api/v1/sessions/{id}/exports should 404 when exports missing."""
    app = _get_app()
    mock_db = make_mock_supabase_db()
    mock_svc = _mock_service(get_session={"id": _SID, "stage": "intake"})

    with patch("app.api.routes.sessions.get_supabase_admin", return_value=mock_db), \
         patch("app.api.routes.sessions.get_session_service", return_value=mock_svc):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(f"/api/v1/sessions/{_SID}/exports")

    assert resp.status_code == 404


# ============================================================
# Test 13: GET /sessions/{id}/exports/tickets — 200 JSON
# ============================================================

@pytest.mark.asyncio
async def test_get_export_tickets():
    """GET /api/v1/sessions/{id}/exports/tickets should return ticket list."""
    app = _get_app()
    mock_db = make_mock_supabase_db()
    mock_svc = _mock_service(get_session={
        "id": _SID,
        "stage": "done",
        "gate_results": {"exports": {
            "tickets": [
                {"title": "Speed up", "priority": "high", "effort_estimate": "M",
                 "source_feedback_count": 5, "rice_score": 60},
            ],
        }},
    })

    with patch("app.api.routes.sessions.get_supabase_admin", return_value=mock_db), \
         patch("app.api.routes.sessions.get_session_service", return_value=mock_svc):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(f"/api/v1/sessions/{_SID}/exports/tickets")

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "Speed up"


# ============================================================
# Test 14: GET /sessions/{id}/exports/prd — 200 with URL
# ============================================================

@pytest.mark.asyncio
async def test_get_export_prd():
    """GET /api/v1/sessions/{id}/exports/prd should return prd_url."""
    app = _get_app()
    mock_db = make_mock_supabase_db()
    mock_svc = _mock_service(get_session={
        "id": _SID,
        "stage": "done",
        "gate_results": {"exports": {"prd_url": "https://storage.example.com/prd.pdf"}},
    })

    with patch("app.api.routes.sessions.get_supabase_admin", return_value=mock_db), \
         patch("app.api.routes.sessions.get_session_service", return_value=mock_svc):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(f"/api/v1/sessions/{_SID}/exports/prd")

    assert resp.status_code == 200
    data = resp.json()
    assert data["prd_url"] == "https://storage.example.com/prd.pdf"
    assert data["expires_in"] == "24 hours"


# ============================================================
# Test 15: GET /sessions/{id}/exports/prd — 503 when no URL
# ============================================================

@pytest.mark.asyncio
async def test_get_export_prd_unavailable():
    """GET /api/v1/sessions/{id}/exports/prd should 503 when prd_url is None."""
    app = _get_app()
    mock_db = make_mock_supabase_db()
    mock_svc = _mock_service(get_session={
        "id": _SID,
        "stage": "done",
        "gate_results": {"exports": {"prd_url": None}},
    })

    with patch("app.api.routes.sessions.get_supabase_admin", return_value=mock_db), \
         patch("app.api.routes.sessions.get_session_service", return_value=mock_svc):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(f"/api/v1/sessions/{_SID}/exports/prd")

    assert resp.status_code == 503
