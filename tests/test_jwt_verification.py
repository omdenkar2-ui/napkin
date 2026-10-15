"""Validate issuer, audience and expiry before trusting a Supabase profile."""

import asyncio
from time import time
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jwt import PyJWK, PyJWTError

from app.api.deps.auth import _get_signing_key, _public_signing_key, get_current_user
from app.core.config import get_settings


@pytest.fixture(autouse=True)
def isolated_jwks_cache(monkeypatch):
    monkeypatch.setattr("app.api.deps.auth._jwks_cache", None)
    monkeypatch.setattr("app.api.deps.auth._jwks_cached_at", 0.0)
    monkeypatch.setattr("app.api.deps.auth._jwks_last_refresh_at", None)
    monkeypatch.setattr("app.api.deps.auth._jwks_refresh_failed", False)
    monkeypatch.setattr("app.api.deps.auth._jwks_refresh_lock", asyncio.Lock())


def signed_token(*, kid="test", **changes):
    private = ec.generate_private_key(ec.SECP256R1())
    private_pem = private.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
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
        jwt.encode(claims, private_pem, algorithm="ES256", headers={"kid": kid}),
        private.public_key(),
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
        {"iss": None},
        {"nbf": int(time()) + 600},
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
    token = jwt.encode(
        {"sub": "test"}, "test-key-that-is-at-least-32-bytes-long",
        algorithm="HS256", headers={"kid": "test"},
    )
    with patch("app.api.deps.auth.httpx.AsyncClient") as client, pytest.raises(PyJWTError):
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


async def test_public_jwks_key_verifies_signature(monkeypatch):
    """Exercise real JWK conversion and JWT validation, with only HTTP/DB mocked."""
    token, public_key = signed_token()
    key_data = jwt.algorithms.ECAlgorithm.to_jwk(public_key, as_dict=True)
    key_data.update(kid="test", alg="ES256", use="sig")
    response = httpx.Response(
        200,
        json={"keys": [key_data]},
        request=httpx.Request("GET", "https://test.supabase.co/auth/v1/.well-known/jwks.json"),
    )
    client = AsyncMock()
    client.get.return_value = response
    client.__aenter__.return_value = client
    monkeypatch.setattr("app.api.deps.auth._jwks_cache", None)
    with patch("app.api.deps.auth.httpx.AsyncClient", return_value=client):
        key = await _get_signing_key(token)
    assert isinstance(key, PyJWK)
    assert jwt.decode(
        token, key, algorithms=["ES256"], audience="authenticated",
        issuer=f"{get_settings().supabase_url.rstrip('/')}/auth/v1",
    )["sub"] == "00000000-0000-0000-0000-000000000001"
    client.get.assert_awaited_once_with(
        "https://test.supabase.co/auth/v1/.well-known/jwks.json", timeout=10,
    )


async def test_token_with_wrong_signature_is_rejected_before_database_access():
    token, _ = signed_token()
    _, different_key = signed_token()
    with (
        patch("app.api.deps.auth._get_signing_key", AsyncMock(return_value=different_key)),
        patch("app.api.deps.auth.get_supabase_admin") as db,
        pytest.raises(HTTPException) as error,
    ):
        await get_current_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token))
    assert error.value.status_code == 401
    db.assert_not_called()


@pytest.mark.parametrize(
    "changes",
    [{"kty": "RSA"}, {"crv": "P-384"}, {"alg": "HS256"}, {"use": "enc"}, {"d": "private"}],
)
def test_key_import_does_not_accept_other_algorithms_or_private_material(changes):
    _, public_key = signed_token()
    key_data = jwt.algorithms.ECAlgorithm.to_jwk(public_key, as_dict=True)
    key_data.update(changes)
    with pytest.raises(ValueError, match="Unexpected Supabase signing key"):
        _public_signing_key(key_data)


@pytest.mark.parametrize("token", ["not-a-token", "e30.e30."])
async def test_malformed_or_unsigned_token_never_fetches_keys_or_profile(token):
    with (
        patch("app.api.deps.auth.httpx.AsyncClient") as client,
        patch("app.api.deps.auth.get_supabase_admin") as db,
        pytest.raises(HTTPException) as error,
    ):
        await get_current_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token))
    assert error.value.status_code == 401
    client.assert_not_called()
    db.assert_not_called()


def jwks_response(keys):
    return httpx.Response(
        200, json={"keys": keys},
        request=httpx.Request("GET", "https://test.supabase.co/auth/v1/.well-known/jwks.json"),
    )


def public_jwk(public_key, kid):
    data = jwt.algorithms.ECAlgorithm.to_jwk(public_key, as_dict=True)
    return {**data, "kid": kid, "alg": "ES256", "use": "sig"}


async def test_unknown_kids_cannot_force_refresh_until_rotation_cooldown(monkeypatch):
    clock = [100.0]
    monkeypatch.setattr("app.api.deps.auth.monotonic", lambda: clock[0])
    original, original_key = signed_token(kid="original")
    rotated, rotated_key = signed_token(kid="rotated")
    unknown, _ = signed_token(kid="random-unknown")
    client = AsyncMock()
    client.__aenter__.return_value = client
    client.get.side_effect = [
        jwks_response([public_jwk(original_key, "original")]),
        jwks_response([public_jwk(rotated_key, "rotated")]),
    ]

    with patch("app.api.deps.auth.httpx.AsyncClient", return_value=client):
        await _get_signing_key(original)
        for token in [unknown, rotated, unknown]:
            with pytest.raises(jwt.InvalidTokenError):
                await _get_signing_key(token)
        # A legitimate cached key still works during the cooldown.
        await _get_signing_key(original)
        assert client.get.await_count == 1
        clock[0] += 30
        key = await _get_signing_key(rotated)
        assert key.key_id == "rotated"
        assert client.get.await_count == 2


async def test_concurrent_cache_misses_share_one_refresh():
    token, public_key = signed_token()
    started = asyncio.Event()
    release = asyncio.Event()

    async def fetch(*args, **kwargs):
        started.set()
        await release.wait()
        return jwks_response([public_jwk(public_key, "test")])

    client = AsyncMock()
    client.__aenter__.return_value = client
    client.get.side_effect = fetch
    with patch("app.api.deps.auth.httpx.AsyncClient", return_value=client):
        first = asyncio.create_task(_get_signing_key(token))
        await started.wait()
        second = asyncio.create_task(_get_signing_key(token))
        release.set()
        keys = await asyncio.gather(first, second)
    assert all(key.key_id == "test" for key in keys)
    client.get.assert_awaited_once()


@pytest.mark.parametrize("payload", [[], {}, {"keys": None}, {"keys": [None]}])
async def test_malformed_jwks_is_a_service_failure_with_retry_backoff(payload):
    token, _ = signed_token()
    client = AsyncMock()
    client.__aenter__.return_value = client
    client.get.return_value = httpx.Response(
        200, json=payload,
        request=httpx.Request("GET", "https://test.supabase.co/auth/v1/.well-known/jwks.json"),
    )
    with (
        patch("app.api.deps.auth.httpx.AsyncClient", return_value=client),
        patch("app.api.deps.auth.get_supabase_admin") as db,
    ):
        for _ in range(2):
            with pytest.raises(HTTPException) as error:
                await get_current_user(
                    HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
                )
            assert error.value.status_code == 503
    client.get.assert_awaited_once()
    db.assert_not_called()


async def test_expired_cached_key_refreshes_after_normal_ttl(monkeypatch):
    clock = [100.0]
    monkeypatch.setattr("app.api.deps.auth.monotonic", lambda: clock[0])
    token, public_key = signed_token()
    client = AsyncMock()
    client.__aenter__.return_value = client
    client.get.return_value = jwks_response([public_jwk(public_key, "test")])
    with patch("app.api.deps.auth.httpx.AsyncClient", return_value=client):
        await _get_signing_key(token)
        clock[0] += 599
        await _get_signing_key(token)
        assert client.get.await_count == 1
        clock[0] += 1
        await _get_signing_key(token)
        assert client.get.await_count == 2
