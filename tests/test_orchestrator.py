"""Tests for the Pipeline Orchestrator — run_pipeline() and run_pipeline_from_stored_feedback()."""

from __future__ import annotations

from copy import deepcopy
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.conftest import (
    make_four_q_answers,
    make_pattern_report,
    make_signals,
    make_spec,
)


# ============================================================
# Helpers
# ============================================================

def _mock_supabase_admin():
    """Create a mock Supabase admin client for orchestrator DB operations."""
    db = MagicMock()
    chain = MagicMock()
    chain.update.return_value = chain
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.in_.return_value = chain
    chain.single.return_value = chain
    chain.order.return_value = chain
    chain.limit.return_value = chain

    # Default: session trigger is "manual"
    result = MagicMock()
    result.data = {"trigger": "manual"}
    chain.execute.return_value = result

    db.table.return_value = chain
    return db


def _start_patches(patch_dict: dict) -> list:
    """Start a dict of patch-target -> mock and return the context managers."""
    cms = [patch(k, v) for k, v in patch_dict.items()]
    for cm in cms:
        cm.start()
    return cms


def _stop_patches(cms: list) -> None:
    """Stop a list of patch context managers."""
    for cm in cms:
        cm.stop()


@pytest.mark.asyncio
async def test_resolved_context_preserves_original_saved_and_exported_evidence():
    """Resolved history is synthesis context, never customer feedback evidence."""
    db = _mock_supabase_admin()
    raw_texts = ["Dashboard is slow"]
    signals = make_signals(1)
    original = deepcopy(signals)
    db.table.return_value.execute.return_value.data = {
        "trigger": "manual",
        "intake_summary": {"raw_texts": raw_texts, "source": "manual"},
    }
    synthesis = AsyncMock(return_value=make_pattern_report())
    export = AsyncMock(return_value={"exports": {"markdown": "# Report"}})
    mocks = {
        "app.db.client.get_supabase_admin": MagicMock(return_value=db),
        "app.services.agents.orchestrator._load_repo_context": AsyncMock(return_value=None),
        "app.services.agents.orchestrator._load_business_context": AsyncMock(return_value=None),
        "app.services.session_lifecycle.get_resolved_patterns":
            AsyncMock(return_value=["Old login issue"]),
        "app.services.agents.intake.extract_signals": AsyncMock(return_value=signals),
        "app.services.agents.synthesis.synthesize_patterns": synthesis,
        "app.services.agents.prioritizer.run_prioritizer":
            AsyncMock(return_value={"opportunities": [{"title": "Speed up dashboard"}]}),
        "app.services.agents.socratic.infer_strategic_context":
            AsyncMock(return_value=make_four_q_answers(complete=True)),
        "app.services.agents.spec_builder.build_spec": AsyncMock(return_value=make_spec()),
        "app.services.agents.task_planner.run_task_planner":
            AsyncMock(return_value={"tasks": []}),
        "app.services.export.export_service.run_export": export,
        "app.services.agents.memory.store_decision": AsyncMock(),
        "app.services.actions.generator.generate_actions_for_session": AsyncMock(),
    }
    cms = _start_patches(mocks)
    try:
        from app.services.agents.orchestrator import run_pipeline
        assert await run_pipeline("sess-1", "proj-1", "user-1", raw_texts) is True
    finally:
        _stop_patches(cms)

    assert signals == original
    synthesized = synthesis.await_args.args[0]
    assert synthesized is not signals
    assert synthesized[0]["raw_text"] == (
        original[0]["raw_text"]
        + "\n\n--- ALREADY RESOLVED (do not resurface these) ---\n- Old login issue"
    )
    saved = next(
        call.args[0]["intake_summary"]
        for call in db.table.return_value.update.call_args_list
        if "intake_summary" in call.args[0]
    )
    assert saved == {"raw_texts": raw_texts, "source": "manual", "items": original}
    assert export.await_args.args[0]["feedback_items"] == original
    stages = [
        call.args[0]["stage"]
        for call in db.table.return_value.update.call_args_list
        if "stage" in call.args[0]
    ]
    assert stages == [
        "intake", "synthesis", "prioritization", "four_questions",
        "spec_building", "task_planning", "task_planning", "done",
    ]


# ============================================================
# Test 1: Full pipeline happy path
# ============================================================

@pytest.mark.asyncio
async def test_run_pipeline_happy_path():
    """Full pipeline should call all agents and complete without errors."""
    db = _mock_supabase_admin()

    agent_mocks = {
        "app.services.agents.intake.extract_signals":
            AsyncMock(return_value=make_signals(5)),
        "app.services.agents.synthesis.synthesize_patterns":
            AsyncMock(return_value=make_pattern_report()),
        "app.services.agents.prioritizer.run_prioritizer":
            AsyncMock(return_value={"opportunities": [{"title": "PDF export"}]}),
        "app.services.agents.socratic.infer_strategic_context":
            AsyncMock(return_value=make_four_q_answers(complete=True)),
        "app.services.agents.spec_builder.build_spec":
            AsyncMock(return_value=make_spec()),
        "app.services.agents.task_planner.run_task_planner":
            AsyncMock(return_value={"tasks": [{"id": "t1", "title": "Task 1"}]}),
        "app.services.export.export_service.run_export":
            AsyncMock(return_value={"exports": {"markdown": "# Report"}}),
        "app.services.agents.memory.store_decision":
            AsyncMock(return_value=None),
        "app.services.actions.generator.generate_actions_for_session":
            AsyncMock(return_value=None),
    }

    infra_mocks = {
        "app.db.client.get_supabase_admin": MagicMock(return_value=db),
        "app.services.agents.orchestrator._load_repo_context": AsyncMock(return_value=None),
        "app.services.agents.orchestrator._load_business_context": AsyncMock(return_value=None),
        "app.services.session_lifecycle.get_resolved_patterns": AsyncMock(return_value=[]),
    }

    all_patches = {**agent_mocks, **infra_mocks}
    cms = _start_patches(all_patches)

    try:
        from app.services.agents.orchestrator import run_pipeline
        await run_pipeline(
            session_id="sess-1",
            project_id="proj-1",
            user_id="user-1",
            raw_texts=["Dashboard is slow", "Need PDF export", "Onboarding is confusing"],
        )
    finally:
        _stop_patches(cms)

    # Verify all sub-agents were called
    agent_mocks["app.services.agents.intake.extract_signals"].assert_awaited_once()
    agent_mocks["app.services.agents.synthesis.synthesize_patterns"].assert_awaited_once()
    agent_mocks["app.services.agents.prioritizer.run_prioritizer"].assert_awaited_once()
    agent_mocks["app.services.agents.socratic.infer_strategic_context"].assert_awaited_once()
    agent_mocks["app.services.agents.spec_builder.build_spec"].assert_awaited_once()
    agent_mocks["app.services.agents.task_planner.run_task_planner"].assert_awaited_once()

    # DB should have been updated
    db.table.assert_called()


# ============================================================
# Test 2: Pipeline handles empty signals gracefully
# ============================================================

@pytest.mark.asyncio
async def test_pipeline_empty_signals_completes_early():
    """If intake returns no signals, pipeline should complete early."""
    db = _mock_supabase_admin()

    empty_intake = AsyncMock(return_value=[])

    cms = _start_patches({
        "app.db.client.get_supabase_admin": MagicMock(return_value=db),
        "app.services.agents.intake.extract_signals": empty_intake,
        "app.services.agents.orchestrator._load_repo_context": AsyncMock(return_value=None),
        "app.services.agents.orchestrator._load_business_context": AsyncMock(return_value=None),
    })

    try:
        from app.services.agents.orchestrator import run_pipeline
        await run_pipeline(
            session_id="sess-2",
            project_id="proj-1",
            user_id="user-1",
            raw_texts=[],
        )
    finally:
        _stop_patches(cms)

    # Intake was called
    empty_intake.assert_awaited_once()

    # Pipeline should have set stage="done" with a message
    update_calls = [
        str(call) for call in db.table.return_value.update.call_args_list
    ]
    assert any("done" in str(c) or "completed" in str(c) for c in update_calls)


# ============================================================
# Test 3: Pipeline catches and logs errors
# ============================================================

@pytest.mark.asyncio
async def test_pipeline_catches_agent_errors():
    """If a sub-agent raises, pipeline should catch and set error status."""
    db = _mock_supabase_admin()

    failing_intake = AsyncMock(side_effect=RuntimeError("LLM exploded"))

    cms = _start_patches({
        "app.db.client.get_supabase_admin": MagicMock(return_value=db),
        "app.services.agents.intake.extract_signals": failing_intake,
        "app.services.agents.orchestrator._load_repo_context": AsyncMock(return_value=None),
        "app.services.agents.orchestrator._load_business_context": AsyncMock(return_value=None),
    })

    try:
        from app.services.agents.orchestrator import run_pipeline
        await run_pipeline(
            session_id="sess-3",
            project_id="proj-1",
            user_id="user-1",
            raw_texts=["Some feedback"],
        )
    finally:
        _stop_patches(cms)

    # Should have called _update with stage="error"
    update_calls = [
        str(call) for call in db.table.return_value.update.call_args_list
    ]
    assert any("error" in str(c) for c in update_calls)


# ============================================================
# Test 4: run_pipeline_from_stored_feedback — happy path
# ============================================================

@pytest.mark.asyncio
async def test_run_pipeline_from_stored_feedback():
    """Should pull feedback_items from DB and run the full pipeline."""
    db = _mock_supabase_admin()

    # Build a chain that handles both feedback_items queries and sessions queries
    feedback_chain = MagicMock()
    feedback_chain.select.return_value = feedback_chain
    feedback_chain.eq.return_value = feedback_chain
    feedback_chain.order.return_value = feedback_chain
    feedback_chain.limit.return_value = feedback_chain
    feedback_chain.update.return_value = feedback_chain
    feedback_chain.in_.return_value = feedback_chain

    feedback_result = MagicMock()
    feedback_result.data = [
        {"id": "fb-1", "raw_text": "Dashboard is slow"},
        {"id": "fb-2", "raw_text": "Need PDF export"},
    ]
    feedback_chain.execute.return_value = feedback_result

    # Default session chain (for _update, _save, session trigger lookup)
    session_chain = MagicMock()
    session_chain.update.return_value = session_chain
    session_chain.select.return_value = session_chain
    session_chain.eq.return_value = session_chain
    session_chain.single.return_value = session_chain
    session_result = MagicMock()
    session_result.data = {"trigger": "manual"}
    session_chain.execute.return_value = session_result

    def _route_table(name):
        if name == "feedback_items":
            return feedback_chain
        return session_chain

    db.table.side_effect = _route_table

    agent_mocks = {
        "app.services.agents.intake.extract_signals":
            AsyncMock(return_value=make_signals(2)),
        "app.services.agents.synthesis.synthesize_patterns":
            AsyncMock(return_value=make_pattern_report()),
        "app.services.agents.prioritizer.run_prioritizer":
            AsyncMock(return_value={"opportunities": []}),
        "app.services.agents.socratic.infer_strategic_context":
            AsyncMock(return_value=make_four_q_answers(complete=True)),
        "app.services.agents.spec_builder.build_spec":
            AsyncMock(return_value=make_spec()),
        "app.services.agents.task_planner.run_task_planner":
            AsyncMock(return_value={"tasks": []}),
        "app.services.export.export_service.run_export":
            AsyncMock(return_value={"exports": {}}),
        "app.services.agents.memory.store_decision":
            AsyncMock(return_value=None),
        "app.services.actions.generator.generate_actions_for_session":
            AsyncMock(return_value=None),
    }

    infra_mocks = {
        "app.db.client.get_supabase_admin": MagicMock(return_value=db),
        "app.services.agents.orchestrator._load_repo_context": AsyncMock(return_value=None),
        "app.services.agents.orchestrator._load_business_context": AsyncMock(return_value=None),
        "app.services.session_lifecycle.get_resolved_patterns": AsyncMock(return_value=[]),
    }

    all_patches = {**agent_mocks, **infra_mocks}
    cms = _start_patches(all_patches)

    try:
        from app.services.agents.orchestrator import run_pipeline_from_stored_feedback
        result = await run_pipeline_from_stored_feedback(
            project_id="proj-1",
            session_id="sess-4",
        )
    finally:
        _stop_patches(cms)

    assert result.get("processed") == 2
    assert result.get("session_id") == "sess-4"


# ============================================================
# Test 5: run_pipeline_from_stored_feedback — no feedback
# ============================================================

@pytest.mark.asyncio
async def test_stored_feedback_no_data():
    """No feedback_items should return error dict."""
    db = _mock_supabase_admin()

    # Mock empty feedback_items query
    feedback_chain = MagicMock()
    feedback_chain.select.return_value = feedback_chain
    feedback_chain.eq.return_value = feedback_chain
    feedback_chain.order.return_value = feedback_chain
    feedback_chain.limit.return_value = feedback_chain

    empty_result = MagicMock()
    empty_result.data = []
    feedback_chain.execute.return_value = empty_result

    db.table.return_value = feedback_chain

    with patch("app.db.client.get_supabase_admin", return_value=db):
        from app.services.agents.orchestrator import run_pipeline_from_stored_feedback
        result = await run_pipeline_from_stored_feedback(
            project_id="proj-1",
            session_id="sess-5",
        )

    assert result.get("error")
    assert "No new feedback" in result["error"]


# ============================================================
# Test 6: start_pipeline_background creates asyncio task
# ============================================================

@pytest.mark.asyncio
async def test_start_pipeline_background():
    """start_pipeline_background should create an asyncio task."""
    with patch("app.services.agents.orchestrator.run_pipeline", new_callable=AsyncMock) as mock_run:
        from app.services.agents.orchestrator import start_pipeline_background
        start_pipeline_background(
            session_id="sess-6",
            project_id="proj-1",
            user_id="user-1",
            raw_texts=["feedback"],
        )
        # Allow the background task to be scheduled
        import asyncio
        await asyncio.sleep(0.05)

    mock_run.assert_awaited_once_with("sess-6", "proj-1", "user-1", ["feedback"])


@pytest.mark.asyncio
async def test_failed_pipeline_leaves_stored_feedback_retryable():
    """A caught stage error must not consume the feedback used by a future retry."""
    db = _mock_supabase_admin()
    db.table.return_value.execute.return_value.data = [
        {"id": "fb-1", "raw_text": "Dashboard is slow"},
    ]
    with patch("app.db.client.get_supabase_admin", return_value=db), \
         patch("app.services.agents.orchestrator.run_pipeline", new_callable=AsyncMock, return_value=False):
        from app.services.agents.orchestrator import run_pipeline_from_stored_feedback
        result = await run_pipeline_from_stored_feedback("proj-1", "sess-1")
    assert "error" in result
    db.table.return_value.update.assert_not_called()


@pytest.mark.asyncio
async def test_only_analyzed_feedback_is_marked_processed():
    db = _mock_supabase_admin()
    db.table.return_value.execute.return_value.data = [
        {"id": "fb-1", "raw_text": "Dashboard is slow"},
        {"id": "fb-2", "raw_text": "  "},
        {"id": "fb-3", "raw_text": None},
    ]
    with patch("app.db.client.get_supabase_admin", return_value=db), \
         patch("app.services.agents.orchestrator.run_pipeline", new_callable=AsyncMock, return_value=True) as run:
        from app.services.agents.orchestrator import run_pipeline_from_stored_feedback
        result = await run_pipeline_from_stored_feedback("proj-1", "sess-1")
    assert result["processed"] == 1
    run.assert_awaited_once_with("sess-1", "proj-1", "system", ["Dashboard is slow"])
    db.table.return_value.in_.assert_called_once_with("id", ["fb-1"])


@pytest.mark.asyncio
async def test_no_supported_opportunity_stops_before_spec_generation():
    db = _mock_supabase_admin()
    mocks = {
        "app.db.client.get_supabase_admin": MagicMock(return_value=db),
        "app.services.agents.orchestrator._load_repo_context": AsyncMock(return_value=None),
        "app.services.agents.orchestrator._load_business_context": AsyncMock(return_value=None),
        "app.services.session_lifecycle.get_resolved_patterns": AsyncMock(return_value=[]),
        "app.services.agents.intake.extract_signals": AsyncMock(return_value=make_signals(1)),
        "app.services.agents.synthesis.synthesize_patterns": AsyncMock(return_value={"clusters": []}),
        "app.services.agents.prioritizer.run_prioritizer": AsyncMock(return_value={"opportunities": []}),
        "app.services.agents.spec_builder.build_spec": AsyncMock(),
    }
    cms = _start_patches(mocks)
    try:
        from app.services.agents.orchestrator import run_pipeline
        completed = await run_pipeline("sess-1", "proj-1", "user-1", ["Works well"])
    finally:
        _stop_patches(cms)
    assert completed is True
    mocks["app.services.agents.spec_builder.build_spec"].assert_not_awaited()
