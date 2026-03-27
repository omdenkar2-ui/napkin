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
        # ── Stage 1: Intake ──────────────────────────────────────
        _update(db, session_id, stage="intake", status="active")
        from app.services.agents.mvp.intake import extract_signals
        signals = await extract_signals(raw_texts)
        _save(db, session_id, intake_summary={"items": signals})

        if len(signals) < 2:
            _update(db, session_id, stage="done", status="completed",
                    completed_at=_now(),
                    messages=[_msg(
                        f"Extracted {len(signals)} signal(s) — need at least 2 for pattern analysis. "
                        "Please provide more feedback."
                    )])
            return

        # ── Stage 2: Synthesis ───────────────────────────────────
        _update(db, session_id, stage="synthesis")
        from app.services.agents.mvp.synthesis import synthesize_patterns
        pattern_report = await synthesize_patterns(signals)
        _save(db, session_id, pattern_report=pattern_report)

        # ── Stage 3: Prioritization ─────────────────────────────
        _update(db, session_id, stage="prioritization")
        from app.services.agents.final.prioritizer import run_prioritizer
        priorities = await run_prioritizer(pattern_report)
        _save(db, session_id, decision_object=priorities)

        # ── Stage 4: Strategic Context (replaces interactive 4Q) ─
        _update(db, session_id, stage="four_questions")
        from app.services.agents.mvp.socratic import infer_strategic_context
        four_q = await infer_strategic_context(pattern_report, priorities)
        _save(db, session_id, four_q_answers=four_q)

        # ── Stage 5: Spec Building ──────────────────────────────
        _update(db, session_id, stage="spec_building")
        from app.services.agents.mvp.spec_builder import build_spec
        spec = await build_spec(pattern_report, four_q, priorities)
        _save(db, session_id, spec_object=spec, cursor_prompt=spec.get("cursor_prompt", ""))

        # ── Stage 6: Task Planning (runs in parallel with any remaining spec work)
        _update(db, session_id, stage="task_planning")
        from app.services.agents.final.task_planner import run_task_planner
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
            from app.services.agents.final.memory import store_decision
            await store_decision(
                {"project_id": project_id, "session_id": session_id,
                 "four_q_answers": four_q, "pattern_report": pattern_report,
                 "prioritization_result": priorities},
                spec, task_plan,
            )
        except Exception:
            logger.debug("memory_store_skipped")

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
