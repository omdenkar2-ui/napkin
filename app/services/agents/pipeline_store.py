"""Persistence operations shared by the pipeline's entrypoints."""

from __future__ import annotations

from typing import Any


def update_session(db, session_id: str, **fields: Any) -> None:
    """Persist stage or result fields through one session update operation."""
    db.table("sessions").update(fields).eq("id", session_id).execute()


def save_intake(db, session_id: str, signals: list[dict]) -> None:
    """Keep source text and intake metadata when adding extracted evidence."""
    row = (
        db.table("sessions").select("intake_summary")
        .eq("id", session_id).single().execute()
    ).data or {}
    update_session(
        db, session_id,
        intake_summary={**(row.get("intake_summary") or {}), "items": signals},
    )


def get_trigger(db, session_id: str) -> str:
    row = (
        db.table("sessions").select("trigger")
        .eq("id", session_id).single().execute()
    ).data or {}
    return row.get("trigger", "manual")


def load_raw_feedback(db, project_id: str) -> list[dict]:
    return (
        db.table("feedback_items").select("id, raw_text")
        .eq("project_id", project_id).eq("status", "raw")
        .order("created_at").limit(500).execute()
    ).data or []


def mark_feedback_processed(db, session_id: str, item_ids: list[str]) -> None:
    db.table("feedback_items").update({
        "status": "processed",
        "session_id": session_id,
    }).in_("id", item_ids).execute()
