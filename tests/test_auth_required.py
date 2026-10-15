"""No deployment environment may silently impersonate a demo user."""

from unittest.mock import patch

import httpx
import pytest

from app.core.config import Environment, get_settings
from app.main import create_app


@pytest.mark.parametrize("environment", list(Environment))
async def test_protected_routes_require_credentials_in_every_environment(environment):
    settings = get_settings().model_copy(update={"app_env": environment})
    with patch("app.main.get_settings", return_value=settings):
        app = create_app()
    assert not app.dependency_overrides
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get("/api/v1/projects")
    assert response.status_code in (401, 403)


async def test_file_parser_requires_authentication():
    app = create_app()
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.post(
            "/api/v1/feedback/parse-file",
            files={"file": ("notes.txt", b"feedback")},
        )
    assert response.status_code in (401, 403)


async def test_file_parser_bounds_the_read_before_parsing():
    from unittest.mock import AsyncMock

    from fastapi import HTTPException

    from app.api.routes.projects import MAX_UPLOAD_SIZE, parse_feedback_file

    upload = AsyncMock()
    upload.filename = "notes.txt"
    upload.read.return_value = b"x" * (MAX_UPLOAD_SIZE + 1)
    with pytest.raises(HTTPException) as error:
        await parse_feedback_file(user={"id": "test"}, file=upload)
    assert error.value.status_code == 413
    upload.read.assert_awaited_once_with(MAX_UPLOAD_SIZE + 1)
