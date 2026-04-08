"""
Napkin — Integration API Routes
OAuth flows, syncing, and management for third-party integrations.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.api.deps.auth import get_current_user, get_current_user_id
from app.core.config import get_settings
from app.db.client import get_supabase_admin
import structlog

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/integrations", tags=["integrations"])


# ── Request / Response Models ────────────────────────────────────────

class OAuthConnectRequest(BaseModel):
    project_id: UUID
    redirect_uri: str


class OAuthCallbackRequest(BaseModel):
    code: str
    project_id: UUID
    redirect_uri: str


class ProjectRequest(BaseModel):
    project_id: UUID


class WebsiteScrapeRequest(BaseModel):
    project_id: UUID
    url: str


# ── Helpers ──────────────────────────────────────────────────────────

def _verify_project_access(project_id: UUID, user: dict) -> None:
    """Verify the authenticated user's org owns the project."""
    db = get_supabase_admin()
    proj = (
        db.table("projects")
        .select("org_id")
        .eq("id", str(project_id))
        .single()
        .execute()
    )
    if not proj.data:
        raise HTTPException(status_code=404, detail="Project not found")
    if proj.data.get("org_id") != user.get("org_id"):
        raise HTTPException(status_code=403, detail="Access denied")


# ── List integrations ────────────────────────────────────────────────

@router.get("", response_model=list[dict])
async def list_integrations(
    project_id: UUID = Query(...),
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """List all integrations for a project."""
    _verify_project_access(project_id, user)

    db = get_supabase_admin()
    result = (
        db.table("integrations")
        .select("*")
        .eq("project_id", str(project_id))
        .execute()
    )
    return result.data or []


# ── Capabilities (what's available to connect?) ──────────────────────

@router.get("/capabilities", response_model=dict)
async def integration_capabilities(
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """Which integrations are available based on server config. No secrets exposed."""
    settings = get_settings()
    _has = lambda *attrs: all(bool(getattr(settings, a, "")) for a in attrs)

    return {
        "gmail": {
            "available": _has("gmail_client_id", "gmail_client_secret"),
            "method": "oauth",
        },
        "github": {
            "available": _has("github_client_id", "github_client_secret"),
            "method": "oauth",
        },
        "github_issues": {
            "available": _has("github_client_id", "github_client_secret"),
            "method": "oauth",
            "requires": "github",
        },
        "intercom": {
            "available": True,
            "method": "token",
        },
        "whatsapp": {
            "available": _has("whatsapp_verify_token"),
            "method": "webhook",
        },
    }

# Keep old endpoint name as alias for backwards compat
@router.get("/config-status", response_model=dict, include_in_schema=False)
async def integration_config_status_compat(
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    return await integration_capabilities(user)


# ── Gmail OAuth ──────────────────────────────────────────────────────

@router.post("/gmail/connect", response_model=dict)
async def gmail_connect(
    body: OAuthConnectRequest,
    user: Annotated[dict, Depends(get_current_user)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
):
    """Start the Gmail OAuth flow."""
    _verify_project_access(body.project_id, user)

    from app.services.scrapers.gmail_scraper import start_gmail_oauth

    auth_url = await start_gmail_oauth(
        project_id=str(body.project_id),
        user_id=str(user_id),
        redirect_uri=body.redirect_uri,
    )
    return {"auth_url": auth_url}


@router.post("/gmail/callback", response_model=dict)
async def gmail_callback(
    body: OAuthCallbackRequest,
    user: Annotated[dict, Depends(get_current_user)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
):
    """Handle the Gmail OAuth callback."""
    _verify_project_access(body.project_id, user)

    from app.services.scrapers.gmail_scraper import handle_gmail_callback

    await handle_gmail_callback(
        code=body.code,
        project_id=str(body.project_id),
        user_id=str(user_id),
        redirect_uri=body.redirect_uri,
    )
    return {"status": "connected"}


@router.post("/gmail/sync", response_model=dict)
async def gmail_sync(
    body: ProjectRequest,
    user: Annotated[dict, Depends(get_current_user)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
):
    """Manually trigger a Gmail sync."""
    _verify_project_access(body.project_id, user)

    from app.services.scrapers.gmail_scraper import sync_gmail_feedback

    result = await sync_gmail_feedback(
        project_id=str(body.project_id),
    )
    return {
        "synced": result.get("synced", 0),
        "skipped": result.get("skipped", 0),
        "errors": result.get("errors", 0),
    }


# ── GitHub OAuth ─────────────────────────────────────────────────────

@router.post("/github/connect", response_model=dict)
async def github_connect(
    body: OAuthConnectRequest,
    user: Annotated[dict, Depends(get_current_user)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
):
    """Start the GitHub OAuth flow."""
    _verify_project_access(body.project_id, user)

    from app.services.github.connector import start_github_oauth

    auth_url = await start_github_oauth(
        project_id=str(body.project_id),
        user_id=str(user_id),
        redirect_uri=body.redirect_uri,
    )
    return {"auth_url": auth_url}


@router.post("/github/callback", response_model=dict)
async def github_callback(
    body: OAuthCallbackRequest,
    user: Annotated[dict, Depends(get_current_user)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
):
    """Handle the GitHub OAuth callback."""
    _verify_project_access(body.project_id, user)

    from app.services.github.connector import handle_github_callback

    await handle_github_callback(
        code=body.code,
        project_id=str(body.project_id),
        user_id=str(user_id),
        redirect_uri=body.redirect_uri,
    )
    return {"status": "connected"}


@router.post("/github/sync", response_model=dict)
async def github_sync(
    body: ProjectRequest,
    user: Annotated[dict, Depends(get_current_user)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
):
    """Manually trigger a GitHub repo sync."""
    _verify_project_access(body.project_id, user)

    from app.services.github.connector import sync_repo_context

    result = await sync_repo_context(
        project_id=str(body.project_id),
    )
    return result


@router.get("/github/context", response_model=dict)
async def github_context(
    project_id: UUID = Query(...),
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """Get the current repo context for a project."""
    _verify_project_access(project_id, user)

    from app.services.github.connector import get_repo_context

    context = await get_repo_context(project_id=project_id)
    if not context:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No GitHub repo context found for this project",
        )
    return context


# ── Website Scraper ──────────────────────────────────────────────────

@router.post("/website/scrape", response_model=dict)
async def website_scrape(
    body: WebsiteScrapeRequest,
    user: Annotated[dict, Depends(get_current_user)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
):
    """Scrape a product URL for business context."""
    _verify_project_access(body.project_id, user)

    from app.services.scrapers.website_scraper import scrape_website

    result = await scrape_website(
        project_id=str(body.project_id),
        url=body.url,
    )
    return result


@router.get("/website/context", response_model=dict)
async def website_context(
    project_id: UUID = Query(...),
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """Get the current business context scraped from the product website."""
    _verify_project_access(project_id, user)

    from app.services.scrapers.website_scraper import get_business_context

    context = await get_business_context(project_id=project_id)
    if not context:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No business context found for this project",
        )
    return context


# ── GitHub Issues ────────────────────────────────────────────────────

@router.post("/github-issues/sync", response_model=dict)
async def github_issues_sync(
    body: ProjectRequest,
    user: Annotated[dict, Depends(get_current_user)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
):
    """Pull GitHub issues from connected repo and write user feedback to feedback_items."""
    _verify_project_access(body.project_id, user)

    from app.services.scrapers.github_issues_scraper import sync_github_issues

    result = await sync_github_issues(project_id=str(body.project_id))
    return result


# ── Intercom (Support Chat) ─────────────────────────────────────────

class IntercomConnectRequest(BaseModel):
    project_id: UUID
    access_token: str


@router.post("/intercom/connect", response_model=dict)
async def intercom_connect(
    body: IntercomConnectRequest,
    user: Annotated[dict, Depends(get_current_user)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
):
    """Connect Intercom as a feedback source."""
    _verify_project_access(body.project_id, user)

    db = get_supabase_admin()
    from uuid import uuid4
    integration = {
        "id": str(uuid4()),
        "project_id": str(body.project_id),
        "user_id": str(user_id),
        "provider": "intercom",
        "status": "connected",
        "access_token": body.access_token,
        "config": {"provider": "intercom"},
    }
    db.table("integrations").upsert(
        integration, on_conflict="project_id,provider",
    ).execute()

    return {"status": "connected", "provider": "intercom"}


@router.post("/intercom/sync", response_model=dict)
async def intercom_sync(
    body: ProjectRequest,
    user: Annotated[dict, Depends(get_current_user)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
):
    """Pull Intercom conversations and write customer feedback to feedback_items."""
    _verify_project_access(body.project_id, user)

    from app.services.scrapers.support_chat_scraper import sync_intercom

    result = await sync_intercom(project_id=str(body.project_id))

    # Auto-trigger pipeline check after sync
    if result.get("items_synced", 0) > 0:
        import asyncio
        from app.services.workers.auto_pipeline import trigger_pipeline_now
        asyncio.create_task(trigger_pipeline_now(str(body.project_id)))

    return result


# ── Disconnect ───────────────────────────────────────────────────────

@router.delete("/{provider}", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_integration(
    provider: str,
    project_id: UUID = Query(...),
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """Disconnect an integration by provider name."""
    _verify_project_access(project_id, user)

    db = get_supabase_admin()
    result = (
        db.table("integrations")
        .delete()
        .eq("project_id", str(project_id))
        .eq("provider", provider)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No {provider} integration found for this project",
        )


# ── WhatsApp Webhook (no auth — Meta calls this directly) ───────────

class WhatsAppWebhookBody(BaseModel):
    """Loose model — Meta sends complex nested JSON."""
    class Config:
        extra = "allow"


@router.get("/whatsapp/webhook")
async def whatsapp_verify(
    mode: str = Query(None, alias="hub.mode"),
    token: str = Query(None, alias="hub.verify_token"),
    challenge: str = Query(None, alias="hub.challenge"),
):
    """WhatsApp webhook verification (GET)."""
    from app.services.scrapers.whatsapp_webhook import verify_webhook

    result = verify_webhook(mode, token, challenge)
    if result is None:
        raise HTTPException(status_code=403, detail="Verification failed")
    return int(result) if result.isdigit() else result


@router.post("/whatsapp/webhook")
async def whatsapp_receive(
    body: dict,
    project_id: UUID = Query(...),
):
    """WhatsApp webhook receiver (POST). No auth — validated by verify_token."""
    from app.services.scrapers.whatsapp_webhook import process_webhook_payload

    result = await process_webhook_payload(
        payload=body,
        project_id=str(project_id),
    )

    # Fire-and-forget: check if pipeline should run on new feedback
    if result.get("processed", 0) > 0:
        import asyncio
        from app.services.workers.auto_pipeline import trigger_pipeline_now
        asyncio.create_task(trigger_pipeline_now(str(project_id)))

    return result
