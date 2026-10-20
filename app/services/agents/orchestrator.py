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

import structlog

from app.services.agents.pipeline_context import (
    build_export_state as _build_export_state,
    load_business_context as _load_business_context,
    load_repo_context as _load_repo_context,
    merge_contexts as _merge_contexts,
    synthesis_signals,
)
from app.services.agents.pipeline_store import (
    get_trigger, load_raw_feedback, mark_feedback_processed, save_intake,
    update_session as _update,
)

# Preserve helper imports used by existing callers while sharing one writer.
_save = _update

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
) -> bool:
    """Persist each stage and return whether analysis completed successfully."""
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
        save_intake(db, session_id, signals)

        if not signals:
            _update(db, session_id, stage="done", status="completed",
                    completed_at=_now(),
                    messages=[_msg(
                        "Could not extract any feedback signals from the provided text. "
                        "Please provide customer feedback to analyze."
                    )])
            return True

        # ── Stage 2: Synthesis ───────────────────────────────────
        _update(db, session_id, stage="synthesis")
        from app.services.agents.synthesis import synthesize_patterns

        enriched_signals = await synthesis_signals(project_id, signals)
        pattern_report = await synthesize_patterns(enriched_signals)
        _save(db, session_id, pattern_report=pattern_report)

        # ── Stage 3: Prioritization ─────────────────────────────
        _update(db, session_id, stage="prioritization")
        from app.services.agents.prioritizer import run_prioritizer
        priorities = await run_prioritizer(pattern_report)
        _save(db, session_id, decision_object=priorities)

        if not priorities.get("opportunities"):
            _update(db, session_id, stage="done", status="completed",
                    completed_at=_now(), messages=[_msg(
                        "Analysis completed without a supported opportunity to build. "
                        "Review the feedback findings before adding more evidence."
                    )])
            return True

        # ── Stage 4: Strategic Context ───────────────────────────
        # Autopilot mode: use rich context (business + repo + decision history)
        # Manual mode: use basic socratic inference (pattern report + priorities only)
        _update(db, session_id, stage="four_questions")

        trigger_mode = get_trigger(db, session_id)

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
        return True

    except Exception:
        logger.exception("pipeline_failed", session_id=session_id)
        _update(db, session_id, stage="error", status="error",
                messages=[_msg(
                    "Analysis could not complete. Please retry; your feedback is retained."
                )])
        return False


async def run_pipeline_from_stored_feedback(project_id: str, session_id: str) -> dict:
    """Pull unprocessed feedback_items for a project and run the full pipeline."""
    from app.db.client import get_supabase_admin
    db = get_supabase_admin()

    items = load_raw_feedback(db, project_id)
    if not items:
        return {"error": "No new feedback to process"}

    valid_items = [
        item for item in items
        if isinstance(item.get("raw_text"), str) and item["raw_text"].strip()
    ]
    raw_texts = [item["raw_text"] for item in valid_items]
    item_ids = [item["id"] for item in valid_items]

    if not raw_texts:
        return {"error": "No valid feedback text found"}

    # Run the full pipeline
    completed = await run_pipeline(session_id, project_id, "system", raw_texts)
    if not completed:
        return {
            "error": "Analysis failed; feedback is retained for retry",
            "session_id": session_id,
        }

    # Mark items as processed and link to session
    mark_feedback_processed(db, session_id, item_ids)

    return {"processed": len(item_ids), "session_id": session_id}


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _msg(content: str) -> dict:
    return {"role": "assistant", "content": content, "timestamp": _now()}
