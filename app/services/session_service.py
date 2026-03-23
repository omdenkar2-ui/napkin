"""
Napkin — Session Service
Bridges the LangGraph agent pipeline with Supabase persistence.
Manages session lifecycle: create -> run stages -> persist -> complete.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from app.db.client import get_supabase_admin
from app.services.agents.mvp.orchestrator import (
    NapkinState,
    done_node,
    four_questions_node,
    intake_node,
    prioritization_node,
    repo_context_node,
    spec_building_node,
    spec_qa_node,
    synthesis_node,
    task_planning_node,
)
from app.services.export.export_service import run_export

logger = logging.getLogger(__name__)


class SessionService:
    """
    Manages Napkin sessions -- the core product loop.
    Each session runs through 9 stages:
    Intake -> Synthesis -> Prioritization -> 4Q -> Repo Context
    -> Spec Building -> Spec QA -> Task Planning -> Done
    """

    # Map stage names to their node functions
    _stage_nodes = {
        "intake": intake_node,
        "synthesis": synthesis_node,
        "prioritization": prioritization_node,
        "four_questions": four_questions_node,
        "repo_context": repo_context_node,
        "spec_building": spec_building_node,
        "spec_qa": spec_qa_node,
        "task_planning": task_planning_node,
        "export": run_export,
        "done": done_node,
    }

    # Stages that need no user input and should auto-advance
    _auto_advance_stages = {"export"}

    def __init__(self) -> None:
        """Initialize with Supabase admin client."""
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
        """Create a new Napkin session and optionally ingest initial feedback."""
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
            return await self.process_message(
                session_id=session_id,
                user_id=user_id,
                content=None,
                raw_texts=initial_feedback,
            )

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
        """
        Process a user message in an active session.
        Routes to the right agent stage based on current session state.
        """
        session = await self._load_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        if session["status"] in ("completed", "error", "abandoned"):
            raise ValueError(f"Session {session_id} is {session['status']}")

        # Build LangGraph state from DB session
        graph_state: NapkinState = {
            "session_id": str(session_id),
            "project_id": session["project_id"],
            "user_id": str(user_id),
            "stage": session["stage"],
            "stage_history": session.get("stage_history", []),
            "raw_texts": raw_texts or (
                [content] if content and session["stage"] == "intake" else []
            ),
            "feedback_items": (
                session.get("intake_summary", {}).get("items", [])
                if session.get("intake_summary")
                else []
            ),
            "pattern_report": session.get("pattern_report"),
            "four_q_answers": session.get("four_q_answers"),
            "spec_object": session.get("spec_object"),
            "repo_snapshot": None,
            "lint_report": None,
            # Agent 5-9 state
            "repo_files": session.get("repo_files") or {},
            "repo_context": session.get("repo_context"),
            "prioritization_result": session.get("decision_object"),
            "spec_qa_report": session.get("spec_qa_report"),
            "sprint_plan": session.get("task_plan"),
            "memory_context": None,
            # Exports
            "exports": session.get("exports") or {},
            # Quality / conversation / control
            "gate_results": session.get("gate_results", {}),
            "messages": session.get("messages", []),
            "pending_questions": [],
            "user_response": (
                content
                if session["stage"] in ("four_questions", "spec_qa")
                else None
            ),
            "retry_count": 0,
            "error": None,
            "is_complete": False,
        }

        # Add user message to history
        if content:
            graph_state["messages"] = list(graph_state.get("messages") or []) + [
                {
                    "role": "user",
                    "content": content,
                    "timestamp": datetime.now(UTC).isoformat(),
                }
            ]

        # Run the correct node based on current stage
        try:
            stage = session["stage"]
            node_fn = self._stage_nodes.get(stage)
            if not node_fn:
                raise ValueError(f"Unknown stage: {stage}")

            result_update = await node_fn(graph_state)
            result_state = {**graph_state, **result_update}

            # Auto-advance non-interactive stages (e.g. export)
            while result_state.get("stage") in self._auto_advance_stages:
                next_fn = self._stage_nodes.get(result_state["stage"])
                if not next_fn:
                    break
                try:
                    next_update = await next_fn(result_state)
                    result_state = {**result_state, **next_update}
                except Exception as auto_err:
                    logger.error(
                        "Auto-advance error at %s: %s",
                        result_state["stage"], auto_err,
                    )
                    result_state["stage"] = "done"
                    result_state["is_complete"] = True
                    break
        except Exception as e:
            logger.error("Agent execution error for session %s: %s", session_id, e)
            result_state = {
                **graph_state,
                "stage": "error",
                "error": str(e),
                "messages": list(graph_state.get("messages") or [])
                + [
                    {
                        "role": "assistant",
                        "content": f"An error occurred: {e}. Please try again.",
                    }
                ],
            }

        # Persist updated state back to DB
        await self._save_session(session_id, result_state)

        # Build response
        messages = result_state.get("messages", [])
        last_assistant_msg = ""
        for msg in reversed(messages):
            if msg.get("role") == "assistant":
                last_assistant_msg = msg.get("content", "")
                break

        return {
            "session_id": str(session_id),
            "stage": result_state.get("stage", "intake"),
            "agent_message": last_assistant_msg,
            "questions": result_state.get("pending_questions", []),
            "gate_results": result_state.get("gate_results"),
            "is_complete": result_state.get("is_complete", False),
            "spec_ready": result_state.get("spec_object") is not None,
            "artifacts": {
                "has_pattern_report": result_state.get("pattern_report") is not None,
                "has_spec": result_state.get("spec_object") is not None,
                "has_sprint_plan": result_state.get("sprint_plan") is not None,
                "has_prioritization": result_state.get("prioritization_result") is not None,
                "has_exports": bool(result_state.get("exports")),
                "feedback_count": len(result_state.get("feedback_items", [])),
            },
        }

    async def get_session(self, session_id: UUID) -> dict | None:
        """Get full session details."""
        return await self._load_session(session_id)

    async def get_session_spec(self, session_id: UUID) -> dict | None:
        """Get the spec from a completed session."""
        session = await self._load_session(session_id)
        if not session:
            return None
        return session.get("spec_object")

    async def get_cursor_prompt(self, session_id: UUID) -> str | None:
        """Get the Cursor-ready prompt from a completed session."""
        session = await self._load_session(session_id)
        if not session:
            return None
        spec = session.get("spec_object") or {}
        return spec.get("cursor_prompt") or session.get("cursor_prompt")

    async def get_sprint_plan(self, session_id: UUID) -> dict | None:
        """Get the sprint plan from a completed session."""
        session = await self._load_session(session_id)
        if not session:
            return None
        return session.get("task_plan")

    async def get_prioritization(self, session_id: UUID) -> dict | None:
        """Get the prioritization results from a session."""
        session = await self._load_session(session_id)
        if not session:
            return None
        return session.get("decision_object")

    async def set_repo_files(
        self, session_id: UUID, repo_files: dict[str, str]
    ) -> None:
        """Attach repo files to a session for Agent 5 analysis."""
        self.db.table("sessions").update(
            {"repo_files": repo_files}
        ).eq("id", str(session_id)).execute()

    async def list_sessions(
        self, project_id: UUID, limit: int = 20, offset: int = 0
    ) -> list[dict]:
        """List sessions for a project."""
        result = (
            self.db.table("sessions")
            .select(
                "id, project_id, stage, status, title, "
                "started_at, completed_at, created_at"
            )
            .eq("project_id", str(project_id))
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return result.data

    # ================================================================
    # PERSISTENCE
    # ================================================================

    async def _load_session(self, session_id: UUID) -> dict | None:
        """Load session state from Supabase."""
        result = (
            self.db.table("sessions")
            .select("*")
            .eq("id", str(session_id))
            .single()
            .execute()
        )
        return result.data

    async def _save_session(self, session_id: UUID, state: dict) -> None:
        """Persist LangGraph state back to Supabase."""
        update_data: dict[str, Any] = {
            "stage": state.get("stage", "intake"),
            "stage_history": state.get("stage_history", []),
            "messages": state.get("messages", []),
            "gate_results": state.get("gate_results", {}),
            "ambiguity_score": (state.get("lint_report") or {}).get("ambiguity_score"),
        }

        # Store feedback items in intake_summary
        if state.get("feedback_items"):
            update_data["intake_summary"] = {"items": state["feedback_items"]}

        # Store agent 1-4 outputs
        if state.get("pattern_report"):
            update_data["pattern_report"] = state["pattern_report"]
        if state.get("four_q_answers"):
            update_data["four_q_answers"] = state["four_q_answers"]
        if state.get("spec_object"):
            update_data["spec_object"] = state["spec_object"]
            update_data["cursor_prompt"] = state["spec_object"].get("cursor_prompt")

        # Store agent 5-9 outputs
        if state.get("prioritization_result"):
            update_data["decision_object"] = state["prioritization_result"]
        if state.get("repo_context"):
            update_data["repo_context"] = state["repo_context"]
        if state.get("spec_qa_report"):
            update_data["spec_qa_report"] = state["spec_qa_report"]
        if state.get("sprint_plan"):
            update_data["task_plan"] = state["sprint_plan"]
        if state.get("exports"):
            update_data["exports"] = state["exports"]

        # Status updates
        if state.get("is_complete") and state.get("stage") == "done":
            update_data["status"] = "completed"
            update_data["completed_at"] = datetime.now(UTC).isoformat()
        elif state.get("stage") == "error":
            update_data["status"] = "error"

        self.db.table("sessions").update(update_data).eq(
            "id", str(session_id)
        ).execute()


# Singleton
_session_service: SessionService | None = None


def get_session_service() -> SessionService:
    """Get the singleton SessionService instance."""
    global _session_service
    if _session_service is None:
        _session_service = SessionService()
    return _session_service
