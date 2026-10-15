"""Auth clients must not share user sessions or revoke somebody else's session."""

from types import SimpleNamespace
from typing import Annotated
from unittest.mock import MagicMock, patch

import httpx
import pytest
from fastapi import FastAPI, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials

from app.api.deps.auth import get_current_user, security
from app.api.routes import auth
from app.db import client as db_client


def test_anon_clients_are_fresh_and_do_not_persist_or_refresh_sessions():
    made = []

    def factory(*args, **kwargs):
        instance = SimpleNamespace(auth=SimpleNamespace(session=None))
        made.append((instance, kwargs["options"]))
        return instance

    with patch.object(db_client, "create_client", side_effect=factory):
        first = db_client.get_supabase_client()
        first.auth.session = "user-a"
        second = db_client.get_supabase_client()

    assert first is not second
    assert second.auth.session is None
    assert len(made) == 2
    for _, options in made:
        assert options.persist_session is False
        assert options.auto_refresh_token is False


def test_service_role_client_remains_cached_separately():
    db_client.get_supabase_admin.cache_clear()
    try:
        with patch.object(db_client, "create_client") as factory:
            first = db_client.get_supabase_admin()
            second = db_client.get_supabase_admin()
        assert first is second
        factory.assert_called_once()
    finally:
        db_client.get_supabase_admin.cache_clear()


async def test_login_and_refresh_do_not_share_client_sessions():
    clients = []

    def factory(*args, **kwargs):
        sdk = MagicMock()

        def sign_in(credentials):
            sdk.session_owner = credentials["email"]
            return SimpleNamespace(
                session=SimpleNamespace(
                    access_token=f"access:{sdk.session_owner}",
                    refresh_token=f"refresh:{sdk.session_owner}",
                    expires_in=3600,
                ),
                user=SimpleNamespace(id=sdk.session_owner, email=sdk.session_owner),
            )

        def refresh(token):
            sdk.session_owner = token
            return SimpleNamespace(
                session=SimpleNamespace(
                    access_token="refreshed-access",
                    refresh_token=token,
                    expires_in=3600,
                )
            )

        sdk.auth.sign_in_with_password.side_effect = sign_in
        sdk.auth.refresh_session.side_effect = refresh
        clients.append(sdk)
        return sdk

    app = FastAPI()
    app.include_router(auth.router)
    with patch.object(db_client, "create_client", side_effect=factory):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://test",
        ) as http:
            a = await http.post(
                "/auth/login", json={"email": "a@example.org", "password": "example-password"}
            )
            b = await http.post(
                "/auth/login", json={"email": "b@example.org", "password": "example-password"}
            )
            refreshed = await http.post(
                "/auth/refresh", json={"refresh_token": "refresh:a@example.org"}
            )

    assert a.status_code == b.status_code == refreshed.status_code == 200
    assert a.json()["access_token"] == "access:a@example.org"
    assert b.json()["access_token"] == "access:b@example.org"
    assert len(clients) == 3
    assert clients[0].session_owner == "a@example.org"
    assert clients[1].session_owner == "b@example.org"
    assert clients[2].session_owner == "refresh:a@example.org"


@pytest.fixture
def logout_app():
    app = FastAPI()
    app.include_router(auth.router)

    async def verified_user(
        credentials: Annotated[HTTPAuthorizationCredentials, Security(security)],
    ):
        if credentials is None or credentials.credentials != "caller-token":
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"id": "verified-caller"}

    app.dependency_overrides[get_current_user] = verified_user
    return app


async def test_logout_revokes_only_the_verified_callers_token(logout_app):
    admin = MagicMock()
    with (
        patch.object(auth, "get_supabase_admin", return_value=admin),
        patch.object(auth, "get_supabase_client") as anon,
    ):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=logout_app),
            base_url="http://test",
        ) as http:
            response = await http.post(
                "/auth/logout", headers={"Authorization": "Bearer caller-token"}
            )
    assert response.status_code == 200
    admin.auth.admin.sign_out.assert_called_once_with("caller-token", scope="local")
    admin.auth.sign_out.assert_not_called()
    anon.assert_not_called()


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer unverified-token"}])
async def test_logout_does_not_revoke_without_verified_credentials(logout_app, headers):
    with patch.object(auth, "get_supabase_admin") as admin:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=logout_app),
            base_url="http://test",
        ) as http:
            response = await http.post("/auth/logout", headers=headers)
    assert response.status_code in (401, 403)
    admin.assert_not_called()


async def test_logout_reports_revocation_failure_without_logging_credentials(logout_app):
    admin = MagicMock()
    admin.auth.admin.sign_out.side_effect = RuntimeError("caller-token private@example.org")
    with (
        patch.object(auth, "get_supabase_admin", return_value=admin),
        patch.object(auth, "logger") as logger,
    ):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=logout_app),
            base_url="http://test",
        ) as http:
            response = await http.post(
                "/auth/logout", headers={"Authorization": "Bearer caller-token"}
            )
    assert response.status_code == 502
    assert "caller-token" not in response.text
    assert "private@example.org" not in response.text
    logger.error.assert_called_once_with("logout_failed", error_type="RuntimeError")


async def test_signup_failure_does_not_log_email_or_provider_error():
    sdk = MagicMock()
    sdk.auth.sign_up.side_effect = RuntimeError("private@example.org example-password")
    body = auth.AuthCredentials(email="private@example.org", password="example-password")
    with (
        patch.object(auth, "get_supabase_client", return_value=sdk),
        patch.object(auth, "logger") as logger,
        pytest.raises(HTTPException) as error,
    ):
        await auth.signup(body)
    assert error.value.status_code == 400
    logger.error.assert_called_once_with("signup_failed", error_type="RuntimeError")
