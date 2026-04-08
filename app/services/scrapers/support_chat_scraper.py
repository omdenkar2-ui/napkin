"""
Napkin — Support Chat Scraper (Intercom, Crisp, HelpScout)
Pulls customer conversations from support tools and writes to feedback_items.
Starts with Intercom — the most common among AI SaaS startups.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import httpx
import structlog

from app.db.client import get_supabase_admin

logger = structlog.get_logger(__name__)


async def sync_intercom(project_id: str) -> dict:
    """
    Pull recent Intercom conversations, extract customer messages,
    and write to feedback_items.
    """
    db = get_supabase_admin()
    log = logger.bind(project_id=project_id)

    # 1. Get Intercom integration
    integration = (
        db.table("integrations")
        .select("*")
        .eq("project_id", project_id)
        .eq("provider", "intercom")
        .limit(1)
        .execute()
    )
    if not integration.data:
        log.warning("intercom_no_integration")
        return {"items_synced": 0, "error": "No Intercom integration found"}

    access_token = integration.data[0].get("access_token") or ""
    if not access_token:
        return {"items_synced": 0, "error": "Intercom access token not configured"}

    # 2. Fetch conversations (last 14 days)
    since_ts = int((datetime.now(UTC) - timedelta(days=14)).timestamp())
    conversations = await _fetch_conversations(access_token, since_ts, max_convos=100)
    log.info("intercom_conversations_fetched", count=len(conversations))

    # 3. Write to feedback_items
    source_id = _ensure_source(db, project_id)
    items_synced = 0

    for convo in conversations:
        try:
            convo_id = convo.get("id", "")
            external_id = f"intercom:{convo_id}"

            # Dedup
            existing = (
                db.table("feedback_items")
                .select("id")
                .eq("project_id", project_id)
                .eq("external_id", external_id)
                .limit(1)
                .execute()
            )
            if existing.data:
                continue

            raw_text = _build_conversation_text(convo)
            if not raw_text or len(raw_text.strip()) < 10:
                continue

            # Determine sender
            source_info = convo.get("source", {})
            sender = (
                source_info.get("author", {}).get("email")
                or source_info.get("author", {}).get("name")
                or "unknown"
            )

            created_at_ts = convo.get("created_at", 0)
            created_at = (
                datetime.fromtimestamp(created_at_ts, tz=UTC).isoformat()
                if created_at_ts else None
            )

            db.table("feedback_items").insert({
                "id": str(uuid4()),
                "project_id": project_id,
                "source_id": source_id,
                "external_id": external_id,
                "raw_text": raw_text,
                "status": "raw",
                "metadata": {
                    "conversation_id": convo_id,
                    "created_at": created_at,
                    "state": convo.get("state", "unknown"),
                    "tags": [
                        t.get("name", "")
                        for t in convo.get("tags", {}).get("tags", [])
                    ],
                    "rating": convo.get("conversation_rating", {}).get("rating"),
                    "sender": sender,
                },
            }).execute()
            items_synced += 1

        except Exception as exc:
            log.warning("intercom_item_insert_failed", convo_id=convo.get("id"), error=str(exc))

    # 4. Update sync metadata
    _update_sync_metadata(db, integration.data[0]["id"])

    log.info("intercom_sync_complete",
             conversations_scanned=len(conversations),
             items_synced=items_synced)

    return {
        "items_synced": items_synced,
        "conversations_scanned": len(conversations),
    }


# ===================================================================
# Intercom API
# ===================================================================

async def _fetch_conversations(
    access_token: str, since_ts: int, max_convos: int = 100,
) -> list[dict]:
    """Fetch recent conversations from Intercom API v2.11."""
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "Intercom-Version": "2.11",
    }
    conversations: list[dict] = []

    async with httpx.AsyncClient(timeout=30) as client:
        # Search for conversations via the search endpoint
        try:
            resp = await client.post(
                "https://api.intercom.io/conversations/search",
                headers=headers,
                json={
                    "query": {
                        "operator": "AND",
                        "value": [
                            {
                                "field": "created_at",
                                "operator": ">",
                                "value": since_ts,
                            }
                        ],
                    },
                    "pagination": {"per_page": min(50, max_convos)},
                },
            )

            if resp.status_code == 200:
                data = resp.json()
                conversations = data.get("conversations", [])[:max_convos]
            else:
                # Fallback to list endpoint
                logger.warning("intercom_search_failed", status=resp.status_code)
                resp2 = await client.get(
                    "https://api.intercom.io/conversations",
                    headers=headers,
                    params={"per_page": min(50, max_convos), "order": "desc"},
                )
                if resp2.status_code == 200:
                    data = resp2.json()
                    all_convos = data.get("conversations", [])
                    conversations = [
                        c for c in all_convos
                        if c.get("created_at", 0) >= since_ts
                    ][:max_convos]

        except Exception as exc:
            logger.error("intercom_fetch_failed", error=str(exc))
            return []

        # Fetch full conversation details (includes message parts)
        enriched = []
        for convo in conversations:
            try:
                detail_resp = await client.get(
                    f"https://api.intercom.io/conversations/{convo['id']}",
                    headers=headers,
                )
                if detail_resp.status_code == 200:
                    enriched.append(detail_resp.json())
                else:
                    enriched.append(convo)
            except Exception:
                enriched.append(convo)

    return enriched


# ===================================================================
# Text Building
# ===================================================================

def _strip_html(html: str) -> str:
    """Remove HTML tags and normalize whitespace."""
    clean = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", clean).strip()


def _build_conversation_text(convo: dict) -> str:
    """Build readable feedback text from an Intercom conversation."""
    parts = []

    # Initial message
    source = convo.get("source", {})
    initial_body = source.get("body", "")
    if initial_body:
        clean = _strip_html(initial_body)
        author = source.get("author", {})
        author_name = author.get("name") or author.get("email") or "User"
        parts.append(f"[{author_name}]: {clean[:2000]}")

    # Conversation parts (follow-up messages)
    conv_parts = (
        convo.get("conversation_parts", {}).get("conversation_parts", [])
    )
    for msg in conv_parts[:10]:
        body = msg.get("body", "")
        if not body:
            continue
        clean = _strip_html(body)

        author = msg.get("author", {})
        author_type = author.get("type", "unknown")
        author_name = author.get("name") or author.get("email") or author_type

        if author_type in ("user", "lead", "contact"):
            parts.append(f"[Customer - {author_name}]: {clean[:1000]}")
        else:
            parts.append(f"[Support - {author_name}]: {clean[:500]}")

    return "\n\n".join(parts)


# ===================================================================
# Helpers
# ===================================================================

def _ensure_source(db, project_id: str) -> str:
    """Get or create a feedback_source for Intercom."""
    existing = (
        db.table("feedback_sources")
        .select("id")
        .eq("project_id", project_id)
        .eq("source_type", "intercom")
        .limit(1)
        .execute()
    )
    if existing.data:
        return existing.data[0]["id"]

    source_id = str(uuid4())
    db.table("feedback_sources").insert({
        "id": source_id,
        "project_id": project_id,
        "source_type": "api",  # "intercom" not in original CHECK constraint, use "api"
        "config": {"provider": "intercom"},
        "is_active": True,
    }).execute()
    return source_id


def _update_sync_metadata(db, integration_id: str) -> None:
    """Update last_synced_at on the integration record."""
    db.table("integrations").update({
        "last_synced_at": datetime.now(UTC).isoformat(),
        "last_error": None,
    }).eq("id", integration_id).execute()
