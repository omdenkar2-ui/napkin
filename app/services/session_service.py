"""
Napkin — Session Service
Bridges the pipeline with Supabase persistence.
Creates sessions and launches the background pipeline.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from app.db.client import get_supabase_admin
from app.services.agents.orchestrator import start_pipeline_background

logger = logging.getLogger(__name__)


class SessionService:
    """
    Manages Napkin sessions.
    Pipeline runs fully in the background — no stage-by-stage message passing.
    """

    def __init__(self) -> None:
        self.db = get_supabase_admin()

    # ================================================================
    # SESSION LIFECYCLE
    # ================================================================

    async def create_session(
        self,
        project_id: UUID,
        user_id: UUID,
        title: str | None = None,
        initial_feedback: list[str] | None = None,
    ) -> dict:
        """Create a new session and optionally start the analysis pipeline."""
        session_id = uuid4()

        session_data = {
            "id": str(session_id),
            "project_id": str(project_id),
            "created_by": str(user_id),
            "stage": "intake",
            "status": "active",
            "title": title or f"Session {datetime.now(UTC).strftime('%b %d %H:%M')}",
            "messages": [],
            "stage_history": [
                {"stage": "intake", "entered_at": datetime.now(UTC).isoformat()}
            ],
        }

        self.db.table("sessions").insert(session_data).execute()

        if initial_feedback:
            # Launch full pipeline in background — returns immediately
            start_pipeline_background(
                str(session_id), str(project_id), str(user_id), initial_feedback,
            )
            return {
                "session_id": str(session_id),
                "stage": "intake",
                "status": "active",
                "agent_message": "Analysis started. Processing your feedback...",
                "questions": [],
                "is_complete": False,
            }

        return {
            "session_id": str(session_id),
            "stage": "intake",
            "status": "active",
            "agent_message": (
                "Session created. Paste customer feedback, interview notes, "
                "or upload files to get started."
            ),
            "questions": ["What customer feedback do you want to analyze?"],
            "is_complete": False,
        }

    async def process_message(
        self,
        session_id: UUID,
        user_id: UUID,
        content: str | None = None,
        raw_texts: list[str] | None = None,
    ) -> dict:
        """Handle a message. If pipeline is running, return current state."""
        session = await self._load_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        # Session already completed or errored
        if session.get("status") in ("completed", "error"):
            return self._build_response(session)

        # New feedback submitted to a waiting session — start pipeline
        texts = raw_texts or ([content] if content and session["stage"] == "intake" else None)
        if texts:
            self.db.table("sessions").update(
                {"status": "active"}
            ).eq("id", str(session_id)).execute()

            start_pipeline_background(
                str(session_id), session["project_id"], str(user_id), texts,
            )

            return {
                "session_id": str(session_id),
                "stage": "intake",
                "agent_message": "Processing your feedback...",
                "questions": [],
                "is_complete": False,
                "spec_ready": False,
                "artifacts": {},
            }

        # No actionable input — return current state
        return self._build_response(session)

    async def get_session(self, session_id: UUID) -> dict | None:
        return await self._load_session(session_id)

    async def get_session_spec(self, session_id: UUID) -> dict | None:
        session = await self._load_session(session_id)
        if not session:
            return None
        return session.get("spec_object")

    async def get_cursor_prompt(self, session_id: UUID) -> str | None:
        session = await self._load_session(session_id)
        if not session:
            return None
        spec = session.get("spec_object") or {}
        return spec.get("cursor_prompt") or session.get("cursor_prompt")

    async def get_sprint_plan(self, session_id: UUID) -> dict | None:
        session = await self._load_session(session_id)
        if not session:
            return None
        return session.get("task_plan")

    async def get_prioritization(self, session_id: UUID) -> dict | None:
        session = await self._load_session(session_id)
        if not session:
            return None
        return session.get("decision_object")

    async def set_repo_files(self, session_id: UUID, repo_files: dict[str, str]) -> None:
        self.db.table("sessions").update(
            {"repo_files": repo_files}
        ).eq("id", str(session_id)).execute()

    async def delete_session(self, session_id: UUID) -> None:
        """Permanently delete a session and all its data."""
        self.db.table("sessions").delete().eq("id", str(session_id)).execute()

    async def list_sessions(
        self, project_id: UUID, limit: int = 20, offset: int = 0
    ) -> list[dict]:
        result = (
            self.db.table("sessions")
            .select("id, project_id, stage, status, title, started_at, completed_at, created_at")
            .eq("project_id", str(project_id))
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return result.data

    # ================================================================
    # INTERNAL
    # ================================================================

    async def _load_session(self, session_id: UUID) -> dict | None:
        result = (
            self.db.table("sessions")
            .select("*")
            .eq("id", str(session_id))
            .single()
            .execute()
        )
        return result.data

    def _build_response(self, session: dict) -> dict:
        """Build a standard response from session state."""
        messages = session.get("messages", [])
        last_msg = ""
        for msg in reversed(messages):
            if msg.get("role") == "assistant":
                last_msg = msg.get("content", "")
                break

        stage = session.get("stage", "intake")

        return {
            "session_id": session.get("id", ""),
            "stage": stage,
            "agent_message": last_msg or _stage_message(stage),
            "questions": [],
            "gate_results": session.get("gate_results"),
            "is_complete": stage == "done",
            "spec_ready": session.get("spec_object") is not None,
            "artifacts": {
                "has_pattern_report": session.get("pattern_report") is not None,
                "has_spec": session.get("spec_object") is not None,
                "has_sprint_plan": session.get("task_plan") is not None,
                "has_prioritization": session.get("decision_object") is not None,
                "has_exports": bool((session.get("gate_results") or {}).get("exports")),
                "feedback_count": len(
                    (session.get("intake_summary") or {}).get("items", [])
                ),
            },
        }


def _stage_message(stage: str) -> str:
    messages = {
        "intake": "Processing your feedback...",
        "synthesis": "Finding patterns across your feedback...",
        "prioritization": "Ranking opportunities...",
        "four_questions": "Analyzing strategic context...",
        "spec_building": "Building recommendations...",
        "task_planning": "Creating action plan...",
        "export": "Preparing results...",
        "done": "Analysis complete.",
        "error": "Something went wrong.",
    }
    return messages.get(stage, "Processing...")


# Singleton
_session_service: SessionService | None = None


def get_session_service() -> SessionService:
    global _session_service
    if _session_service is None:
        _session_service = SessionService()
    return _session_service
