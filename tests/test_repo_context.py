"""Tests for the Repo Deep Context agent (Agent 5)."""

from __future__ import annotations

import json
from unittest.mock import patch

import pytest

from tests.conftest import make_mock_react_llm, make_repo_files


# ============================================================
# Test 1: package.json with next → "next.js"
# ============================================================

def test_detect_stack_nextjs():
    """package.json with 'next' dep should detect Next.js."""
    from app.services.agents.final.repo_context import detect_stack

    files = {
        "package.json": json.dumps({
            "dependencies": {"react": "^18", "next": "^14"}
        }),
        "tsconfig.json": "{}",
    }
    stack = detect_stack(files)

    assert stack["framework"] == "next.js"
    assert stack["language"] == "typescript"


# ============================================================
# Test 2: Prisma schema → entities extracted
# ============================================================

@pytest.mark.asyncio
async def test_entity_extraction():
    """Model files should produce entity results."""
    mock_llm = make_mock_react_llm({
        "entities": [
            {"name": "User", "fields": [{"name": "id", "type": "string"}],
             "relations": ["Post"], "file_path": "src/models/user.ts"},
        ]
    })

    from app.services.agents.final.repo_context import extract_entities
    model_files = {"src/models/user.ts": "export interface User { id: string; }"}
    entities = await extract_entities(model_files, mock_llm)

    assert len(entities) >= 1
    assert entities[0]["name"] == "User"


# ============================================================
# Test 3: FastAPI router → routes extracted
# ============================================================

@pytest.mark.asyncio
async def test_route_extraction():
    """Route files should produce route results."""
    mock_llm = make_mock_react_llm({
        "routes": [
            {"method": "GET", "path": "/users", "handler": "getUsers",
             "description": "Get all users", "file_path": "src/routes/api.ts"},
        ]
    })

    from app.services.agents.final.repo_context import extract_routes
    route_files = {"src/routes/api.ts": "router.get('/users', getUsers)"}
    routes = await extract_routes(route_files, mock_llm)

    assert len(routes) >= 1
    assert routes[0]["method"] == "GET"


# ============================================================
# Test 4: Empty repo → minimal pack
# ============================================================

@pytest.mark.asyncio
async def test_empty_repo_minimal_pack():
    """Empty repo_files should return a minimal context pack."""
    from app.services.agents.final.repo_context import run_repo_context
    result = await run_repo_context({})

    assert result["stack"] == {}
    assert result["entities"] == []
    assert result["routes"] == []
    assert result["auth_model"]["strategy"] == "unknown"
