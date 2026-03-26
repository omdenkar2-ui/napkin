"""
Orchestrates all exports. Called as the final pipeline node.
Handles failures gracefully — if PDF fails, tickets still complete.
Maps NapkinState field names to export-expected field names automatically.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import structlog

from app.services.analytics import generate_session_analytics
from app.services.export.prd_exporter import export_prd
from app.services.export.tickets_exporter import export_tickets

logger = structlog.get_logger(__name__)


# ============================================================
# State mapping: NapkinState → Export-compatible dict
# ============================================================

def _prepare_export_state(state: dict) -> dict:
    """Map NapkinState fields to export-compatible field names.

    NapkinState uses: pattern_report, prioritization_result, spec_object
    Export layer uses: pattern_cards, prioritized_features, spec

    If export field names already exist (e.g. in tests), they pass through unchanged.
    """
    out: dict[str, Any] = dict(state)

    # pattern_report.clusters → pattern_cards
    if "pattern_cards" not in out:
        pr = out.get("pattern_report") or {}
        out["pattern_cards"] = [
            {
                "pattern_id": c.get("id", ""),
                "name": c.get("label", ""),
                "description": c.get("pain_summary", c.get("description", "")),
                "confidence": c.get("confidence", 0),
                "source_item_ids": c.get("signal_ids", []),
            }
            for c in pr.get("clusters", [])
        ]

    # prioritization_result.opportunities → prioritized_features
    if "prioritized_features" not in out:
        prio = out.get("prioritization_result") or {}
        out["prioritized_features"] = [
            {
                "pattern_id": (
                    o.get("source_patterns", [o.get("id")])[0]
                    if o.get("source_patterns")
                    else o.get("id", "")
                ),
                "rice_score": o.get("rice_score", 0),
                "effort_weeks": o.get("effort_weeks", 1),
                "title": o.get("title", ""),
            }
            for o in prio.get("opportunities", [])
        ]

    # spec_object → spec
    if "spec" not in out:
        spec_obj = out.get("spec_object") or {}
        features = []
        for task in spec_obj.get("task_breakdown", []):
            features.append({
                "feature_id": task.get("title", ""),
                "title": task.get("title", ""),
                "description": task.get("description", ""),
                "acceptance_criteria": task.get("acceptance_criteria", []),
            })
        out["spec"] = {
            "features": features,
            "decision": spec_obj.get("decision", {}),
        }

    # cursor_prompt — extract from spec_object if not top-level
    if "cursor_prompt" not in out:
        spec_obj = state.get("spec_object") or {}
        out["cursor_prompt"] = spec_obj.get("cursor_prompt", "")

    return out


# ============================================================
# Main export pipeline node
# ============================================================

async def run_export(state: dict) -> dict:
    """Run all exports and return partial state update.

    Returns dict with: exports, stage, is_complete.
    """
    session_id = state.get("session_id", "unknown")
    logger.info("export.start", session_id=session_id)

    # Map NapkinState → export field names
    export_state = _prepare_export_state(state)

    exports: dict = {}
    errors: list[str] = []

    # Analytics — always runs first; charts embedded in PDF + returned via API
    try:
        analytics = generate_session_analytics(state)
        exports["analytics"] = analytics.to_dict()
        logger.info("export.analytics_done", charts=len(analytics.charts))
    except Exception as e:
        logger.error("export.analytics_failed", error=str(e))
        errors.append(f"analytics: {e!s}")
        exports["analytics"] = {"charts": {}, "stats": {}, "errors": {str(e)}, "chart_count": 0}

    # Tickets — always runs, no external deps
    try:
        tickets = export_tickets(export_state)
        exports["tickets"] = tickets
        exports["ticket_count"] = len(tickets)
        logger.info("export.tickets_done", count=len(tickets))
    except Exception as e:
        logger.error("export.tickets_failed", error=str(e))
        errors.append(f"tickets: {e!s}")
        exports["tickets"] = []

    # PDF — may fail if Supabase storage unavailable
    try:
        pdf_bytes = export_prd(export_state)
        prd_url = _upload_pdf(pdf_bytes, session_id)
        exports["prd_url"] = prd_url
        exports["prd_size_bytes"] = len(pdf_bytes)
        logger.info("export.prd_done", size=len(pdf_bytes))
    except Exception as e:
        logger.error("export.prd_failed", error=str(e))
        errors.append(f"prd: {e!s}")
        exports["prd_url"] = None

    # Cursor prompt passthrough
    exports["cursor_prompt"] = export_state.get("cursor_prompt", "")
    exports["exported_at"] = datetime.now(timezone.utc).isoformat()
    exports["errors"] = errors

    return {
        "exports": exports,
        "stage": "done",
        "is_complete": True,
        "stage_history": _record_export_exit(state),
    }


def _record_export_exit(state: dict) -> list[dict]:
    """Append export exit record to stage_history."""
    history = list(state.get("stage_history") or [])
    history.append({
        "stage": "export",
        "exited_at": datetime.now(timezone.utc).isoformat(),
    })
    return history


def _upload_pdf(pdf_bytes: bytes, session_id: str) -> str | None:
    try:
        from app.db.client import get_supabase_admin
        client = get_supabase_admin()
        path = f"sessions/{session_id}/prd.pdf"
        client.storage.from_("exports").upload(
            path,
            pdf_bytes,
            {"content-type": "application/pdf", "upsert": "true"},
        )
        result = client.storage.from_("exports").create_signed_url(path, 86400)
        return result.get("signedURL") or result.get("signedUrl")
    except Exception as e:
        logger.warning("export.supabase_upload_failed", error=str(e))
        return None
