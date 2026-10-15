"""Scheduled ingestion must preserve retryable failures and its trigger mode."""

from unittest.mock import AsyncMock, MagicMock, patch

from app.services.workers.auto_pipeline import _check_project, trigger_pipeline_now


async def test_scheduled_failure_is_not_reported_as_success():
    db = MagicMock()
    feedback = MagicMock()
    feedback.select.return_value = feedback
    feedback.eq.return_value = feedback
    feedback.execute.return_value.count = 5

    sessions = MagicMock()
    for method in ("select", "eq", "gte", "limit", "neq", "insert", "update"):
        getattr(sessions, method).return_value = sessions
    sessions.execute.return_value.data = []

    project = MagicMock()
    project.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
        "created_by": "user-1"
    }
    db.table.side_effect = lambda name: {
        "feedback_items": feedback,
        "sessions": sessions,
        "projects": project,
    }[name]

    with patch(
        "app.services.agents.orchestrator.run_pipeline_from_stored_feedback",
        new_callable=AsyncMock,
        return_value={"error": "Analysis failed; feedback is retained for retry"},
    ):
        result = await _check_project(db, "proj-1", "Test project")

    assert result["status"] == "error"
    assert sessions.insert.call_args.args[0]["trigger"] == "auto"
    assert sessions.update.call_args.args[0]["status"] == "error"
    feedback.update.assert_not_called()


async def test_webhook_passes_its_trigger_mode():
    with (
        patch("app.services.workers.auto_pipeline.get_supabase_admin"),
        patch(
            "app.services.workers.auto_pipeline._check_project",
            new_callable=AsyncMock,
            return_value={"status": "queued"},
        ) as check,
    ):
        await trigger_pipeline_now("proj-1")
    assert check.call_args.kwargs["trigger"] == "webhook"
