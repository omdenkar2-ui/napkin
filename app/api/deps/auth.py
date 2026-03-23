
"""
Napkin — Auth Dependencies
Supabase JWT verification for FastAPI routes.
"""

from typing import Annotated
from uuid import UUID

import httpx
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwk, jwt

from app.core.config import get_settings
from app.db.client import get_supabase_admin

security = HTTPBearer()

# Cache the JWKS public key to avoid fetching on every request
_jwks_cache: dict | None = None


def _get_jwks_url() -> str:
    settings = get_settings()
    return f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"


async def _get_signing_key(token: str) -> jwk.Key:
    """Fetch JWKS from Supabase and return the matching signing key."""
    global _jwks_cache

    header = jwt.get_unverified_header(token)
    kid = header.get("kid")

    if _jwks_cache is None:
        async with httpx.AsyncClient() as client:
            resp = await client.get(_get_jwks_url(), timeout=10)
        resp.raise_for_status()
        _jwks_cache = resp.json()

    for key_data in _jwks_cache.get("keys", []):
        if key_data.get("kid") == kid:
            return jwk.construct(key_data)

    # Key not found — refresh cache once in case keys rotated
    async with httpx.AsyncClient() as client:
        resp = await client.get(_get_jwks_url(), timeout=10)
    resp.raise_for_status()
    _jwks_cache = resp.json()

    for key_data in _jwks_cache.get("keys", []):
        if key_data.get("kid") == kid:
            return jwk.construct(key_data)

    raise JWTError(f"No matching key found for kid={kid}")


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

    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
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
