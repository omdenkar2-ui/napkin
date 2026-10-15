"""
Napkin — Auth Routes
Supabase-backed authentication endpoints.
"""

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from app.api.deps.auth import get_current_user, security
from app.db.client import get_supabase_admin, get_supabase_client
from app.schemas.api import ProfileUpdate

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


class AuthCredentials(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=6, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/signup")
async def signup(body: AuthCredentials):
    """Sign up with email/password (Supabase handles the rest)."""
    client = get_supabase_client()
    try:
        result = client.auth.sign_up({"email": body.email, "password": body.password})
        return {
            "message": "Check your email for verification link",
            "user_id": result.user.id if result.user else None,
        }
    except Exception as e:
        logger.error("signup_failed", error_type=type(e).__name__)
        raise HTTPException(status_code=400, detail="Signup failed") from e


@router.post("/login")
async def login(body: AuthCredentials):
    """Login with email/password."""
    client = get_supabase_client()
    try:
        result = client.auth.sign_in_with_password({"email": body.email, "password": body.password})
        return {
            "access_token": result.session.access_token,
            "refresh_token": result.session.refresh_token,
            "expires_in": result.session.expires_in,
            "token_type": "bearer",
            "user": {
                "id": result.user.id,
                "email": result.user.email,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid credentials") from e


@router.post("/login/google")
async def login_google():
    """Get Google OAuth URL for login."""
    client = get_supabase_client()
    try:
        result = client.auth.sign_in_with_oauth({"provider": "google"})
        return {"url": result.url}
    except Exception as e:
        logger.error("oauth_login_failed", provider="google", error_type=type(e).__name__)
        raise HTTPException(status_code=400, detail="OAuth login failed") from e


@router.post("/refresh")
async def refresh_token(body: RefreshRequest):
    """Refresh access token."""
    client = get_supabase_client()
    try:
        result = client.auth.refresh_session(body.refresh_token)
        return {
            "access_token": result.session.access_token,
            "refresh_token": result.session.refresh_token,
            "expires_in": result.session.expires_in,
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid refresh token") from e


@router.post("/logout")
async def logout(
    user: Annotated[dict, Depends(get_current_user)],
    credentials: Annotated[HTTPAuthorizationCredentials, Security(security)],
):
    """Revoke the authenticated caller's session, leaving other sessions intact.

    Supabase revokes that session's refresh tokens. Its already-issued access
    token remains valid until expiry, so the caller must also discard its tokens.
    """
    try:
        get_supabase_admin().auth.admin.sign_out(credentials.credentials, scope="local")
    except Exception as e:
        logger.error("logout_failed", error_type=type(e).__name__)
        raise HTTPException(
            status_code=502, detail="Could not end session. Please try again."
        ) from e
    return {"message": "Logged out"}


@router.get("/me", response_model=dict)
async def get_me(user: Annotated[dict, Depends(get_current_user)]):
    """Get current user profile."""
    return user


@router.patch("/me", response_model=dict)
async def update_me(
    body: ProfileUpdate,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Update current user profile."""
    db = get_supabase_admin()

    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        return user

    result = db.table("profiles").update(update_data).eq("id", user["id"]).execute()
    return result.data[0] if result.data else user
