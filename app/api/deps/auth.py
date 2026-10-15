
"""
Napkin — Auth Dependencies
Supabase JWT verification for FastAPI routes.
"""

from time import monotonic
from typing import Annotated
from uuid import UUID

import httpx
import jwt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWK, PyJWTError

from app.core.config import get_settings
from app.db.client import get_supabase_admin

security = HTTPBearer()

# Cache the JWKS public key to avoid fetching on every request
_jwks_cache: dict | None = None
_jwks_cached_at = 0.0
_JWKS_TTL_SECONDS = 600


def _get_jwks_url() -> str:
    settings = get_settings()
    return f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"


def _public_signing_key(key_data: dict) -> PyJWK:
    """Use only the expected public signing-key type from the configured issuer."""
    if (
        key_data.get("kty") != "EC"
        or key_data.get("crv") != "P-256"
        or key_data.get("alg", "ES256") != "ES256"
        or key_data.get("use", "sig") != "sig"
        or "d" in key_data
    ):
        raise ValueError("Unexpected Supabase signing key")
    return PyJWK.from_dict(key_data, algorithm="ES256")


async def _get_signing_key(token: str) -> PyJWK:
    """Fetch JWKS from Supabase and return the matching signing key."""
    global _jwks_cache, _jwks_cached_at

    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    if header.get("alg") != "ES256" or not isinstance(kid, str) or not kid:
        raise jwt.InvalidTokenError("Unsupported signing key")

    if _jwks_cache is None or monotonic() - _jwks_cached_at >= _JWKS_TTL_SECONDS:
        async with httpx.AsyncClient() as client:
            resp = await client.get(_get_jwks_url(), timeout=10)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        _jwks_cached_at = monotonic()

    for key_data in _jwks_cache.get("keys", []):
        if key_data.get("kid") == kid:
            return _public_signing_key(key_data)

    # Key not found — refresh cache once in case keys rotated
    async with httpx.AsyncClient() as client:
        resp = await client.get(_get_jwks_url(), timeout=10)
    resp.raise_for_status()
    _jwks_cache = resp.json()
    _jwks_cached_at = monotonic()

    for key_data in _jwks_cache.get("keys", []):
        if key_data.get("kid") == kid:
            return _public_signing_key(key_data)

    raise jwt.InvalidTokenError("No matching signing key")


async def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials, Security(security)
    ],
) -> dict:
    """
    Verify Supabase JWT and return user profile.
    Used as a FastAPI dependency on protected routes.
    """
    token = credentials.credentials

    try:
        signing_key = await _get_signing_key(token)
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=["ES256"],
            audience="authenticated",
            issuer=f"{get_settings().supabase_url.rstrip('/')}/auth/v1",
            options={"require": ["exp", "sub", "aud", "iss"]},
        )

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: no subject",
            )

        # Fetch profile from Supabase
        db = get_supabase_admin()
        result = (
            db.table("profiles")
            .select("*")
            .eq("id", user_id)
            .single()
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found",
            )

        return result.data

    except PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e

    except (httpx.HTTPError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is temporarily unavailable",
        ) from e


async def get_current_user_id(
    user: Annotated[dict, Depends(get_current_user)]
) -> UUID:
    """Extract just the user ID from the authenticated user."""
    return UUID(user["id"])


async def require_org_member(
    user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """Ensure the user belongs to an organization."""
    if not user.get("org_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must belong to an organization",
        )
    return user


async def require_org_admin(
    user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """Ensure the user is an admin or owner of their org."""
    if user.get("role") not in ("admin", "owner"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or owner role required",
        )
    return user
