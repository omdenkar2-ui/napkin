"""
Napkin — Pipeline Orchestrator

Runs the full analysis pipeline as a single async flow.
No LangGraph state machine, no ReAct loops. Direct, parallel, fast.

Pipeline stages:
  intake → synthesis → prioritization → context_inference →
  spec_building → task_planning → export → done

Each stage updates the DB so the frontend can show progress via polling.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

import structlog

logger = structlog.get_logger(__name__)

# Keep references to background tasks to prevent GC
_background_tasks: set[asyncio.Task] = set()


def start_pipeline_background(
    session_id: str,
    project_id: str,
    user_id: str,
    raw_texts: list[str],
) -> None:
    """Launch the pipeline as a background asyncio task."""
    task = asyncio.create_task(
        run_pipeline(session_id, project_id, user_id, raw_texts)
    )
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


async def run_pipeline(
    session_id: str,
    project_id: str,
    user_id: str,
    raw_texts: list[str],
) -> None:
    """Run the full Napkin analysis pipeline. Updates DB at each stage."""
    from app.db.client import get_supabase_admin
    db = get_supabase_admin()

    try:
        # ── Load enrichment context (GitHub repo + website business context) ──
        repo_context = await _load_repo_context(project_id)
        business_context = await _load_business_context(project_id)

        # ── Stage 1: Intake ──────────────────────────────────────
        _update(db, session_id, stage="intake", status="active")
        from app.services.agents.intake import extract_signals
        signals = await extract_signals(raw_texts)
        _save(db, session_id, intake_summary={"items": signals})

        if not signals:
            _update(db, session_id, stage="done", status="completed",
                    completed_at=_now(),
                    messages=[_msg(
                        "Could not extract any feedback signals from the provided text. "
                        "Please provide customer feedback to analyze."
                    )])
            return

        # ── Stage 2: Synthesis ───────────────────────────────────
        _update(db, session_id, stage="synthesis")
        from app.services.agents.synthesis import synthesize_patterns

        # Inject resolved patterns so synthesis doesn't resurface solved problems
        resolved_labels = []
        try:
            from app.services.session_lifecycle import get_resolved_patterns
            resolved_labels = await get_resolved_patterns(project_id)
        except Exception:
            pass

        # If resolved patterns exist, inject them into each signal's context
        if resolved_labels:
            resolved_ctx = "\n\n--- ALREADY RESOLVED (do not resurface these) ---\n"
            resolved_ctx += "\n".join(f"- {label}" for label in resolved_labels)
            for signal in signals:
                if isinstance(signal, dict) and signal.get("raw_text"):
                    signal["raw_text"] = signal["raw_text"] + resolved_ctx

        pattern_report = await synthesize_patterns(signals)
        _save(db, session_id, pattern_report=pattern_report)

        # ── Stage 3: Prioritization ─────────────────────────────
        _update(db, session_id, stage="prioritization")
        from app.services.agents.prioritizer import run_prioritizer
        priorities = await run_prioritizer(pattern_report)
        _save(db, session_id, decision_object=priorities)

        # ── Stage 4: Strategic Context ───────────────────────────
        # Autopilot mode: use rich context (business + repo + decision history)
        # Manual mode: use basic socratic inference (pattern report + priorities only)
        _update(db, session_id, stage="four_questions")

        session_row = db.table("sessions").select("trigger").eq("id", session_id).single().execute()
        trigger_mode = (session_row.data or {}).get("trigger", "manual")

        if trigger_mode in ("auto", "webhook"):
            from app.services.agents.context_inferrer import infer_autopilot_context
            four_q = await infer_autopilot_context(project_id, pattern_report, priorities)
        else:
            from app.services.agents.socratic import infer_strategic_context
            four_q = await infer_strategic_context(pattern_report, priorities)

        _save(db, session_id, four_q_answers=four_q)

        # ── Stage 5: Spec Building ──────────────────────────────
        _update(db, session_id, stage="spec_building")
        from app.services.agents.spec_builder import build_spec
        # Merge repo + business context for richer specs
        enriched_context = _merge_contexts(repo_context, business_context)
        spec = await build_spec(pattern_report, four_q, priorities, enriched_context)
        _save(db, session_id, spec_object=spec, cursor_prompt=spec.get("cursor_prompt", ""))

        # ── Stage 6: Task Planning (runs in parallel with any remaining spec work)
        _update(db, session_id, stage="task_planning")
        from app.services.agents.task_planner import run_task_planner
        task_plan = await run_task_planner(spec)
        _save(db, session_id, task_plan=task_plan)
        _save(db, session_id, task_plan=task_plan)

        # ── Stage 7: Export (use task_planning stage since 'export' not in DB enum)
        _update(db, session_id, stage="task_planning")
        export_state = _build_export_state(
            session_id, signals, pattern_report, priorities, spec, four_q, task_plan,
        )
        from app.services.export.export_service import run_export
        export_result = await run_export(export_state)
        # 'exports' column doesn't exist — store in gate_results
        _save(db, session_id, gate_results={"exports": export_result.get("exports", {})})

        # Store decision in memory (best-effort)
        try:
            from app.services.agents.memory import store_decision
            await store_decision(
                {"project_id": project_id, "session_id": session_id,
                 "four_q_answers": four_q, "pattern_report": pattern_report,
                 "prioritization_result": priorities},
                spec, task_plan,
            )
        except Exception:
            logger.debug("memory_store_skipped")

        # ── Stage 8: Auto-generate actions (best-effort) ────────
        try:
            from app.services.actions.generator import generate_actions_for_session
            await generate_actions_for_session(session_id, project_id, user_id)
        except Exception:
            logger.debug("action_generation_skipped")

        # ── Done ────────────────────────────────────────────────
        _update(db, session_id, stage="done", status="completed", completed_at=_now())

        logger.info(
            "pipeline_complete",
            session_id=session_id,
            signals=len(signals),
            clusters=len(pattern_report.get("clusters", [])),
            tasks=len(task_plan.get("tasks", [])),
        )

    except Exception as e:
        logger.exception("pipeline_failed", session_id=session_id)
        _update(db, session_id, stage="error", status="error",
                messages=[_msg(f"Analysis failed: {e}")])


async def run_pipeline_from_stored_feedback(project_id: str, session_id: str) -> dict:
    """Pull unprocessed feedback_items for a project and run the full pipeline."""
    from app.db.client import get_supabase_admin
    db = get_supabase_admin()

    result = (
        db.table("feedback_items")
        .select("id, raw_text")
        .eq("project_id", project_id)
        .eq("status", "raw")
        .order("created_at")
        .limit(500)
        .execute()
    )

    if not result.data:
        return {"error": "No new feedback to process"}

    raw_texts = [item["raw_text"] for item in result.data if item.get("raw_text")]
    item_ids = [item["id"] for item in result.data]

    if not raw_texts:
        return {"error": "No valid feedback text found"}

    # Run the full pipeline
    await run_pipeline(session_id, project_id, "system", raw_texts)

    # Mark items as processed and link to session
    db.table("feedback_items").update({
        "status": "processed",
        "session_id": session_id,
    }).in_("id", item_ids).execute()

    return {"processed": len(item_ids), "session_id": session_id}


# ============================================================
# DB helpers
# ============================================================

def _update(db, session_id: str, **fields: Any) -> None:
    """Update session fields in Supabase."""
    db.table("sessions").update(fields).eq("id", session_id).execute()


def _save(db, session_id: str, **fields: Any) -> None:
    """Save data fields to the session."""
    db.table("sessions").update(fields).eq("id", session_id).execute()


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _msg(content: str) -> dict:
    return {"role": "assistant", "content": content, "timestamp": _now()}


async def _load_repo_context(project_id: str) -> dict | None:
    """Load GitHub repo context for the project (if connected)."""
    try:
        from app.services.github.connector import get_repo_context
        return await get_repo_context(project_id)
    except Exception:
        return None


async def _load_business_context(project_id: str) -> dict | None:
    """Load website business context for the project (if scraped)."""
    try:
        from app.services.scrapers.website_scraper import get_business_context
        return await get_business_context(project_id)
    except Exception:
        return None


def _merge_contexts(repo_context: dict | None, business_context: dict | None) -> dict:
    """Merge repo + business context into a single enrichment dict for spec builder."""
    merged = {}
    if repo_context:
        merged["readme"] = repo_context.get("readme_content", "")
        merged["stack_guess"] = repo_context.get("stack")
        merged["routes_text"] = str(repo_context.get("routes", ""))
        merged["schema_text"] = repo_context.get("schema_snapshot", "")
    if business_context:
        merged["business_context"] = {
            "product_name": business_context.get("product_name", ""),
            "core_value_prop": business_context.get("core_value_prop", ""),
            "target_customer": business_context.get("target_customer", ""),
            "key_features": business_context.get("key_features", []),
            "pricing_model": business_context.get("pricing_model", ""),
            "competitors": business_context.get("competitors", []),
            "tone": business_context.get("tone", ""),
        }
    return merged


def _build_export_state(
    session_id: str,
    signals: list[dict],
    pattern_report: dict,
    priorities: dict,
    spec: dict,
    four_q: dict,
    task_plan: dict,
) -> dict:
    """Build the state dict that export_service expects."""
    return {
        "session_id": session_id,
        "feedback_items": signals,
        "pattern_report": pattern_report,
        "prioritization_result": priorities,
        "spec_object": spec,
        "four_q_answers": four_q,
        "sprint_plan": task_plan,
        "stage_history": [],
        "repo_files": {},
        "repo_context": None,
    }
