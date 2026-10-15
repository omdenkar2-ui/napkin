"""Validate issuer, audience and expiry before trusting a Supabase profile."""

from time import time
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jose import JWTError, jwk, jwt

from app.api.deps.auth import _get_signing_key, get_current_user
from app.core.config import get_settings


def signed_token(**changes):
    private = ec.generate_private_key(ec.SECP256R1())
    private_pem = private.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    public = private.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    claims = {
        "sub": "00000000-0000-0000-0000-000000000001",
        "aud": "authenticated",
        "iss": f"{get_settings().supabase_url.rstrip('/')}/auth/v1",
        "exp": int(time()) + 600,
    }
    claims.update(changes)
    claims = {k: v for k, v in claims.items() if v is not None}
    return (
        jwt.encode(claims, private_pem, algorithm="ES256", headers={"kid": "test"}),
        jwk.construct(public, algorithm="ES256"),
    )


@pytest.mark.parametrize(
    "changes",
    [
        {"iss": "https://wrong-project.supabase.co/auth/v1"},
        {"aud": "other-app"},
        {"exp": int(time()) - 60},
        {"exp": None},
        {"sub": None},
        {"aud": None},
    ],
)
async def test_invalid_claims_are_rejected_before_database_access(changes):
    token, key = signed_token(**changes)
    with (
        patch("app.api.deps.auth._get_signing_key", AsyncMock(return_value=key)),
        patch("app.api.deps.auth.get_supabase_admin") as db,
        pytest.raises(HTTPException) as error,
    ):
        await get_current_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token))
    assert error.value.status_code == 401
    db.assert_not_called()


async def test_valid_signed_token_loads_profile():
    token, key = signed_token()
    db = MagicMock()
    query = db.table.return_value.select.return_value.eq.return_value.single.return_value
    query.execute.return_value.data = {"id": "user"}
    with (
        patch("app.api.deps.auth._get_signing_key", AsyncMock(return_value=key)),
        patch("app.api.deps.auth.get_supabase_admin", return_value=db),
    ):
        user = await get_current_user(
            HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        )
    assert user == {"id": "user"}


async def test_wrong_algorithm_rejected_without_jwks_request():
    token = jwt.encode({"sub": "test"}, "test-key", algorithm="HS256", headers={"kid": "test"})
    with patch("app.api.deps.auth.httpx.AsyncClient") as client, pytest.raises(JWTError):
        await _get_signing_key(token)
    client.assert_not_called()


async def test_jwks_outage_is_not_reported_as_bad_credentials():
    with patch(
        "app.api.deps.auth._get_signing_key", AsyncMock(side_effect=httpx.ConnectError("offline"))
    ), pytest.raises(HTTPException) as error:
        await get_current_user(
            HTTPAuthorizationCredentials(scheme="Bearer", credentials="token")
        )
    assert error.value.status_code == 503
