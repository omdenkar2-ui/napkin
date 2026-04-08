"""
Napkin — WhatsApp Webhook Handler (Add-on 1B)
Receives incoming WhatsApp messages via Meta Cloud API webhooks,
parses text messages, and stores them as feedback_items.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import structlog

from app.core.config import get_settings
from app.db.client import get_supabase_admin

logger = structlog.get_logger(__name__)


# ===================================================================
# Webhook Verification
# ===================================================================

def verify_webhook(mode: str | None, token: str | None, challenge: str | None) -> str | None:
    """
    Verify the WhatsApp webhook subscription.
    Returns the challenge string on success, None on failure.
    Meta sends: hub.mode=subscribe, hub.verify_token=<our token>, hub.challenge=<string>
    """
    settings = get_settings()

    if mode == "subscribe" and token == settings.whatsapp_verify_token:
        logger.info("whatsapp_webhook_verified")
        return challenge

    logger.warning("whatsapp_webhook_verify_failed", mode=mode)
    return None


# ===================================================================
# Webhook Payload Processing
# ===================================================================

async def process_webhook_payload(payload: dict, project_id: str) -> dict:
    """
    Parse incoming WhatsApp webhook payload and store text messages as feedback.

    Meta Cloud API webhook structure:
    {
      "object": "whatsapp_business_account",
      "entry": [{
        "id": "<WABA_ID>",
        "changes": [{
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {"display_phone_number": "...", "phone_number_id": "..."},
            "contacts": [{"profile": {"name": "..."}, "wa_id": "..."}],
            "messages": [{
              "from": "sender_phone",
              "id": "wamid.xxx",
              "timestamp": "1234567890",
              "type": "text",
              "text": {"body": "actual message"}
            }]
          },
          "field": "messages"
        }]
      }]
    }

    Returns {processed, skipped}.
    """
    db = get_supabase_admin()
    log = logger.bind(project_id=project_id)

    processed = 0
    skipped = 0

    try:
        entries = payload.get("entry", [])
        if not entries:
            log.info("whatsapp_webhook_empty_payload")
            return {"processed": 0, "skipped": 0}

        # Ensure we have a feedback source for WhatsApp
        source_id = _ensure_source(db, project_id)

        # Build a contacts lookup for sender names
        for entry in entries:
            changes = entry.get("changes", [])
            for change in changes:
                if change.get("field") != "messages":
                    continue

                value = change.get("value", {})
                contacts = value.get("contacts", [])
                messages = value.get("messages", [])

                # Build contacts map: wa_id -> display name
                contact_map: dict[str, str] = {}
                for contact in contacts:
                    wa_id = contact.get("wa_id", "")
                    name = contact.get("profile", {}).get("name", "")
                    if wa_id:
                        contact_map[wa_id] = name

                for message in messages:
                    msg_type = message.get("type")

                    # Only process text messages
                    if msg_type != "text":
                        skipped += 1
                        log.debug("whatsapp_skip_non_text", type=msg_type)
                        continue

                    sender_phone = message.get("from", "")
                    wa_message_id = message.get("id", "")
                    timestamp_str = message.get("timestamp", "")
                    body = message.get("text", {}).get("body", "")

                    if not body.strip():
                        skipped += 1
                        continue

                    # Dedup: skip if this WhatsApp message was already ingested
                    if wa_message_id:
                        existing = (
                            db.table("feedback_items")
                            .select("id")
                            .eq("project_id", project_id)
                            .eq("external_id", f"wa:{wa_message_id}")
                            .limit(1)
                            .execute()
                        )
                        if existing.data:
                            skipped += 1
                            continue

                    # Resolve sender name
                    sender_name = contact_map.get(sender_phone, "")

                    # Parse timestamp (Unix epoch string)
                    received_at = None
                    if timestamp_str:
                        try:
                            received_at = datetime.fromtimestamp(
                                int(timestamp_str), tz=UTC
                            ).isoformat()
                        except (ValueError, OSError):
                            received_at = datetime.now(UTC).isoformat()

                    item = {
                        "id": str(uuid4()),
                        "project_id": project_id,
                        "source_id": source_id,
                        "external_id": f"wa:{wa_message_id}" if wa_message_id else None,
                        "raw_text": body[:5000],
                        "status": "raw",
                        "metadata": {
                            "sender": sender_phone,
                            "sender_name": sender_name,
                            "timestamp": received_at,
                            "wa_message_id": wa_message_id,
                        },
                    }

                    try:
                        db.table("feedback_items").insert(item).execute()
                        processed += 1
                    except Exception as exc:
                        log.warning(
                            "whatsapp_insert_error",
                            wa_message_id=wa_message_id,
                            error=str(exc),
                        )
                        skipped += 1

    except Exception as exc:
        log.error("whatsapp_webhook_processing_error", error=str(exc))

    # Update integration last_synced_at
    if processed > 0:
        try:
            integration = (
                db.table("integrations")
                .select("id")
                .eq("project_id", project_id)
                .eq("provider", "whatsapp")
                .limit(1)
                .execute()
            )
            if integration.data:
                db.table("integrations").update({
                    "last_synced_at": datetime.now(UTC).isoformat(),
                    "last_error": None,
                }).eq("id", integration.data[0]["id"]).execute()
        except Exception:
            pass

    log.info("whatsapp_webhook_complete", processed=processed, skipped=skipped)
    return {"processed": processed, "skipped": skipped}


# ===================================================================
# Helpers
# ===================================================================

def _ensure_source(db, project_id: str) -> str:
    """Get or create a feedback_source for WhatsApp in this project."""
    existing = (
        db.table("feedback_sources")
        .select("id")
        .eq("project_id", project_id)
        .eq("source_type", "whatsapp")
        .limit(1)
        .execute()
    )
    if existing.data:
        return existing.data[0]["id"]

    source_id = str(uuid4())
    db.table("feedback_sources").insert({
        "id": source_id,
        "project_id": project_id,
        "source_type": "whatsapp",
        "config": {},
        "is_active": True,
    }).execute()
    return source_id
