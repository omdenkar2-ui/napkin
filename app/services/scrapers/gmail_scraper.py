"""
Napkin — Gmail Scraper (Add-on 1A)
OAuth flow + periodic sync of user-feedback emails from Gmail.
Classifies each email via Claude (fast LLM) before storing.
"""

from __future__ import annotations

import base64
import re
from datetime import UTC, datetime, timedelta
from email.utils import parsedate_to_datetime
from urllib.parse import urlencode
from uuid import uuid4

import httpx
import structlog
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.config import get_settings
from app.core.llm import cached_system, get_fast_llm
from app.db.client import get_supabase_admin

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"
SCOPES = "https://www.googleapis.com/auth/gmail.readonly"
MAX_EMAILS = 100

CLASSIFICATION_SYSTEM = (
    "You are a feedback classifier. Given an email subject and body, determine "
    "whether this email contains genuine user/customer feedback, a bug report, "
    "feature request, NPS response, support complaint, or product suggestion.\n"
    "Respond with ONLY valid JSON: {\"is_feedback\": true/false, \"confidence\": 0.0-1.0, \"reason\": \"...\"}"
)


# ===================================================================
# OAuth Flow
# ===================================================================

async def start_gmail_oauth(
    project_id: str,
    user_id: str,
    redirect_uri: str,
) -> str:
    """Build and return the Google OAuth consent URL."""
    settings = get_settings()

    params = {
        "client_id": settings.gmail_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",
        "prompt": "select_account consent",
        "state": f"{project_id}:{user_id}",
    }
    url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    logger.info("gmail_oauth_start", project_id=project_id, user_id=user_id)
    return url


async def handle_gmail_callback(
    code: str,
    project_id: str,
    user_id: str,
    redirect_uri: str,
) -> dict:
    """Exchange the authorization code for tokens and persist the integration."""
    settings = get_settings()
    db = get_supabase_admin()

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.gmail_client_id,
                "client_secret": settings.gmail_client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        resp.raise_for_status()
        tokens = resp.json()

    expires_at = datetime.now(UTC) + timedelta(seconds=tokens.get("expires_in", 3600))

    integration = {
        "id": str(uuid4()),
        "project_id": project_id,
        "user_id": user_id,
        "provider": "gmail",
        "status": "active",
        "access_token": tokens["access_token"],
        "refresh_token": tokens.get("refresh_token", ""),
        "token_expires_at": expires_at.isoformat(),
        "config": {},
        "last_synced_at": None,
        "last_error": None,
        "sync_count": 0,
    }

    # Upsert — one Gmail integration per project+user
    db.table("integrations").upsert(
        integration,
        on_conflict="project_id,user_id,provider",
    ).execute()

    logger.info("gmail_oauth_complete", project_id=project_id, user_id=user_id)
    return {"status": "connected", "provider": "gmail", "project_id": project_id}


# ===================================================================
# Token Refresh
# ===================================================================

async def _refresh_access_token(integration: dict) -> str:
    """Refresh the Gmail access token if expired. Returns a valid access token."""
    expires_at = datetime.fromisoformat(integration["token_expires_at"])
    if datetime.now(UTC) < expires_at - timedelta(minutes=2):
        return integration["access_token"]

    settings = get_settings()
    db = get_supabase_admin()

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.gmail_client_id,
                "client_secret": settings.gmail_client_secret,
                "refresh_token": integration["refresh_token"],
                "grant_type": "refresh_token",
            },
        )
        resp.raise_for_status()
        tokens = resp.json()

    new_expires = datetime.now(UTC) + timedelta(seconds=tokens.get("expires_in", 3600))

    db.table("integrations").update({
        "access_token": tokens["access_token"],
        "token_expires_at": new_expires.isoformat(),
    }).eq("id", integration["id"]).execute()

    logger.info("gmail_token_refreshed", integration_id=integration["id"])
    return tokens["access_token"]


# ===================================================================
# Email Fetching Helpers
# ===================================================================

def _extract_body(payload: dict) -> str:
    """Recursively extract plain-text body from a Gmail message payload."""
    mime_type = payload.get("mimeType", "")

    # Simple single-part message
    if mime_type == "text/plain" and payload.get("body", {}).get("data"):
        return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")

    # Multipart — recurse into parts
    parts = payload.get("parts", [])
    for part in parts:
        part_mime = part.get("mimeType", "")
        if part_mime == "text/plain" and part.get("body", {}).get("data"):
            return base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="replace")

    # Fallback: try HTML if no plain text found
    for part in parts:
        if part.get("mimeType") == "text/html" and part.get("body", {}).get("data"):
            html = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="replace")
            return re.sub(r"<[^>]+>", " ", html).strip()

    # Deeply nested multipart
    for part in parts:
        nested = _extract_body(part)
        if nested:
            return nested

    return ""


def _header(headers: list[dict], name: str) -> str:
    """Extract a header value by name from Gmail message headers."""
    for h in headers:
        if h.get("name", "").lower() == name.lower():
            return h.get("value", "")
    return ""


# ===================================================================
# Classification
# ===================================================================

async def _classify_email(subject: str, body: str) -> dict:
    """Use Claude (fast) to decide if an email is user feedback."""
    llm = get_fast_llm()
    truncated_body = body[:3000]

    try:
        response = await llm.ainvoke([
            cached_system(CLASSIFICATION_SYSTEM),
            HumanMessage(content=f"Subject: {subject}\n\nBody:\n{truncated_body}"),
        ])
        import json
        text = response.content if isinstance(response.content, str) else str(response.content)
        # Extract JSON from possible markdown fences
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group())
    except Exception as exc:
        logger.warning("gmail_classify_error", error=str(exc))

    return {"is_feedback": False, "confidence": 0.0, "reason": "classification_failed"}


# ===================================================================
# Main Sync
# ===================================================================

async def sync_gmail_feedback(project_id: str) -> dict:
    """
    Fetch recent emails, classify each, and store qualifying ones as feedback_items.
    Returns {synced, skipped, errors}.
    """
    db = get_supabase_admin()
    log = logger.bind(project_id=project_id)

    # 1. Load integration record
    result = (
        db.table("integrations")
        .select("*")
        .eq("project_id", project_id)
        .eq("provider", "gmail")
        .eq("status", "active")
        .single()
        .execute()
    )
    integration = result.data
    if not integration:
        log.warning("gmail_sync_no_integration")
        return {"synced": 0, "skipped": 0, "errors": 1}

    synced = 0
    skipped = 0
    errors = 0

    try:
        # 2. Refresh token if needed
        access_token = await _refresh_access_token(integration)

        # 3. Build search query
        query = "newer_than:1d (subject:feedback OR subject:NPS OR subject:support OR subject:bug OR from:noreply)"

        async with httpx.AsyncClient(timeout=60) as client:
            headers = {"Authorization": f"Bearer {access_token}"}

            # 4. List matching message IDs
            list_resp = await client.get(
                f"{GMAIL_API_BASE}/messages",
                headers=headers,
                params={"q": query, "maxResults": MAX_EMAILS},
            )
            list_resp.raise_for_status()
            messages_list = list_resp.json().get("messages", [])

            if not messages_list:
                log.info("gmail_sync_no_messages")
                _update_sync_metadata(db, integration["id"], synced)
                return {"synced": 0, "skipped": 0, "errors": 0}

            log.info("gmail_sync_found", count=len(messages_list))

            # 5. Fetch and process each message
            # Get or create the feedback source
            source_id = _ensure_source(db, project_id)

            for msg_stub in messages_list:
                try:
                    gmail_msg_id = msg_stub["id"]

                    # Dedup: skip if this Gmail message was already ingested
                    existing = (
                        db.table("feedback_items")
                        .select("id")
                        .eq("project_id", project_id)
                        .eq("external_id", f"gmail:{gmail_msg_id}")
                        .limit(1)
                        .execute()
                    )
                    if existing.data:
                        skipped += 1
                        continue

                    msg_resp = await client.get(
                        f"{GMAIL_API_BASE}/messages/{gmail_msg_id}",
                        headers=headers,
                        params={"format": "full"},
                    )
                    msg_resp.raise_for_status()
                    msg = msg_resp.json()

                    hdrs = msg.get("payload", {}).get("headers", [])
                    subject = _header(hdrs, "Subject")
                    sender = _header(hdrs, "From")
                    date_str = _header(hdrs, "Date")
                    body = _extract_body(msg.get("payload", {}))

                    if not body.strip():
                        skipped += 1
                        continue

                    # 6. Classify via LLM
                    classification = await _classify_email(subject, body)
                    if not classification.get("is_feedback") or classification.get("confidence", 0) < 0.5:
                        skipped += 1
                        continue

                    # 7. Store as feedback_item
                    received_at = None
                    if date_str:
                        try:
                            received_at = parsedate_to_datetime(date_str).isoformat()
                        except Exception:
                            pass

                    item = {
                        "id": str(uuid4()),
                        "project_id": project_id,
                        "source_id": source_id,
                        "external_id": f"gmail:{gmail_msg_id}",
                        "raw_text": f"Subject: {subject}\n\n{body[:5000]}",
                        "status": "raw",
                        "metadata": {
                            "gmail_message_id": gmail_msg_id,
                            "sender": sender,
                            "subject": subject,
                            "received_at": received_at,
                            "classification_confidence": classification.get("confidence"),
                        },
                    }
                    db.table("feedback_items").insert(item).execute()
                    synced += 1

                except Exception as exc:
                    log.warning("gmail_message_error", message_id=msg_stub.get("id"), error=str(exc))
                    errors += 1

        # 8. Update sync metadata
        _update_sync_metadata(db, integration["id"], synced)

    except Exception as exc:
        log.error("gmail_sync_failed", error=str(exc))
        db.table("integrations").update({
            "last_error": str(exc)[:500],
        }).eq("id", integration["id"]).execute()
        errors += 1

    log.info("gmail_sync_complete", synced=synced, skipped=skipped, errors=errors)
    return {"synced": synced, "skipped": skipped, "errors": errors}


# ===================================================================
# Helpers
# ===================================================================

def _ensure_source(db, project_id: str) -> str:
    """Get or create a feedback_source for Gmail in this project."""
    existing = (
        db.table("feedback_sources")
        .select("id")
        .eq("project_id", project_id)
        .eq("source_type", "gmail")
        .limit(1)
        .execute()
    )
    if existing.data:
        return existing.data[0]["id"]

    source_id = str(uuid4())
    db.table("feedback_sources").insert({
        "id": source_id,
        "project_id": project_id,
        "source_type": "gmail",
        "config": {},
        "is_active": True,
    }).execute()
    return source_id


def _update_sync_metadata(db, integration_id: str, synced_count: int) -> None:
    """Update last_synced_at and increment sync_count on the integration."""
    db.table("integrations").update({
        "last_synced_at": datetime.now(UTC).isoformat(),
        "sync_count": synced_count,  # Will be overwritten; ideally use RPC for increment
        "last_error": None,
    }).eq("id", integration_id).execute()
