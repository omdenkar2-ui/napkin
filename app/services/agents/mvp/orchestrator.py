"""
Napkin — Session Director (Orchestrator)

The LangGraph state machine that drives the entire Napkin session through
9 stages: intake -> synthesis -> prioritization -> four_questions ->
repo_context -> spec_building -> spec_qa -> task_planning -> done.

Design principles:
- All routing is deterministic (no LLM in routing logic).
- Each node is async, calls a sub-agent, returns partial state.
- The graph pauses (returns END) when it needs user input.
- Re-entry: caller loads state from DB, sets user_response, invokes at the right node.
- Stage transitions are recorded in stage_history with timestamps.
- Messages accumulate -- every interaction appends to messages[].
- Errors are caught, stored in state, and retried up to 3 times.
"""

from __future__ import annotations

import structlog
from datetime import UTC, datetime
from typing import Any, TypedDict

from langgraph.graph import END, StateGraph

from app.services.agents.mvp.intake import intake_structurer_node
from app.services.agents.mvp.socratic import socratic_questioner_node
from app.services.agents.mvp.spec_builder import spec_builder_node
from app.services.agents.mvp.synthesis import signal_synthesis_node
from app.services.export.export_service import run_export

logger = structlog.get_logger(__name__)

MAX_RETRIES = 3


# ============================================================
# STATE TYPE (LangGraph TypedDict state)
# ============================================================

class NapkinState(TypedDict, total=False):
    """The master state that flows through the LangGraph pipeline."""
    # Identity
    session_id: str
    project_id: str
    user_id: str

    # Stage machine
    stage: str
    stage_history: list[dict[str, Any]]

    # Raw inputs
    raw_texts: list[str]
    feedback_items: list[dict[str, Any]]

    # Agent 1-4 outputs
    pattern_report: dict[str, Any] | None
    four_q_answers: dict[str, Any] | None
    spec_object: dict[str, Any] | None
    repo_snapshot: dict[str, Any] | None
    lint_report: dict[str, Any] | None

    # Agent 5-9 outputs
    repo_files: dict[str, str]
    repo_context: dict[str, Any] | None
    prioritization_result: dict[str, Any] | None
    spec_qa_report: dict[str, Any] | None
    sprint_plan: dict[str, Any] | None
    memory_context: dict[str, Any] | None

    # Quality gates
    gate_results: dict[str, Any]

    # Conversation
    messages: list[dict[str, Any]]
    pending_questions: list[str]
    user_response: str | None

    # Exports
    exports: dict[str, Any]

    # Control
    retry_count: int
    error: str | None
    is_complete: bool


# ============================================================
# HELPER: timestamp & message utilities
# ============================================================

def _now_iso() -> str:
    """Return current UTC time as ISO string."""
    return datetime.now(UTC).isoformat()


def _append_message(state: NapkinState, role: str, content: str) -> list[dict]:
    """Return messages list with a new entry appended."""
    msgs = list(state.get("messages") or [])
    msgs.append({"role": role, "content": content, "timestamp": _now_iso()})
    return msgs


def _record_stage_exit(state: NapkinState, stage: str) -> list[dict]:
    """Return stage_history with a new exit record appended."""
    history = list(state.get("stage_history") or [])
    history.append({"stage": stage, "exited_at": _now_iso()})
    return history


# ============================================================
# NODE FUNCTIONS
# ============================================================

async def intake_node(state: NapkinState) -> dict:
    """Stage: Intake -- process raw feedback, retrieve memory context."""
    result = await intake_structurer_node(state)
    result["stage"] = "intake"

    # Retrieve memory context for this project
    project_id = state.get("project_id", "")
    if project_id:
        try:
            from app.services.agents.final.memory import retrieve_context
            memory_ctx = await retrieve_context(project_id)
            result["memory_context"] = memory_ctx
        except Exception:
            logger.debug("Memory retrieval skipped")

    # Auto-advance if we have enough items
    items = result.get("feedback_items", state.get("feedback_items", []))
    if len(items) >= 3:
        result["stage"] = "synthesis"
        result["stage_history"] = _record_stage_exit(state, "intake")

    return result


async def synthesis_node(state: NapkinState) -> dict:
    """Stage: Synthesis -- discover patterns from signals."""
    result = await signal_synthesis_node(state)

    if result.get("pattern_report"):
        result["stage"] = "prioritization"
        result["stage_history"] = _record_stage_exit(state, "synthesis")
    else:
        result["stage"] = "synthesis"

    return result


async def prioritization_node(state: NapkinState) -> dict:
    """Stage: Prioritization -- rank opportunities using RICE scoring."""
    pattern_report = state.get("pattern_report") or {}

    try:
        from app.services.agents.final.prioritizer import run_prioritizer
        result = await run_prioritizer(pattern_report, state.get("repo_context"))
        opps = result.get("opportunities", [])

        return {
            "stage": "four_questions",
            "prioritization_result": result,
            "stage_history": _record_stage_exit(state, "prioritization"),
            "messages": _append_message(
                state, "assistant",
                f"Identified {len(opps)} opportunities. "
                f"Top pick: {opps[0]['title'] if opps else 'N/A'}. "
                "Starting strategic questions.",
            ),
        }
    except Exception as e:
        logger.exception("Prioritization node error")
        # Non-blocking: proceed to four_questions even on failure
        return {
            "stage": "four_questions",
            "stage_history": _record_stage_exit(state, "prioritization"),
            "messages": _append_message(
                state, "assistant",
                f"Prioritization encountered an issue ({e}), proceeding to questions.",
            ),
        }


async def four_questions_node(state: NapkinState) -> dict:
    """Stage: Four Questions -- guided strategic questioning."""
    result = await socratic_questioner_node(state)

    four_q = result.get("four_q_answers") or state.get("four_q_answers") or {}
    if four_q.get("is_complete"):
        result["stage"] = "repo_context"
        result["stage_history"] = _record_stage_exit(state, "four_questions")
    else:
        result["stage"] = "four_questions"

    return result


async def repo_context_node(state: NapkinState) -> dict:
    """Stage: Repo Context (optional) -- analyze repo files if provided."""
    repo_files = state.get("repo_files") or {}

    if not repo_files:
        return {
            "stage": "spec_building",
            "repo_context": None,
            "stage_history": _record_stage_exit(state, "repo_context"),
            "messages": _append_message(
                state, "assistant",
                "No repo files provided. Proceeding to spec building.",
            ),
        }

    try:
        from app.services.agents.final.repo_context import run_repo_context
        result = await run_repo_context(repo_files)
        stack = result.get("stack", {})
        entity_count = len(result.get("entities", []))
        route_count = len(result.get("routes", []))

        return {
            "stage": "spec_building",
            "repo_context": result,
            "stage_history": _record_stage_exit(state, "repo_context"),
            "messages": _append_message(
                state, "assistant",
                f"Repo analyzed -- stack: {stack.get('framework', 'unknown')}, "
                f"{entity_count} entities, {route_count} routes found.",
            ),
        }
    except Exception as e:
        logger.exception("Repo context node error")
        # Non-blocking: proceed without repo context
        return {
            "stage": "spec_building",
            "repo_context": None,
            "stage_history": _record_stage_exit(state, "repo_context"),
            "messages": _append_message(
                state, "assistant",
                f"Repo analysis failed ({e}), proceeding without repo context.",
            ),
        }


async def spec_building_node(state: NapkinState) -> dict:
    """Stage: Spec Building -- generate the 6-section spec + cursor prompt."""
    result = await spec_builder_node(state)

    if result.get("spec_object"):
        result["stage"] = "spec_qa"
        result["stage_history"] = _record_stage_exit(state, "spec_building")
    else:
        result["stage"] = "spec_building"

    return result


async def spec_qa_node(state: NapkinState) -> dict:
    """Stage: Spec QA -- hard quality gate. Can block and request clarification."""
    spec = state.get("spec_object") or {}
    four_q = state.get("four_q_answers") or {}
    repo_context = state.get("repo_context")

    try:
        from app.services.agents.final.spec_qa import run_spec_qa
        result = await run_spec_qa(spec, four_q, repo_context)

        if result.get("passed"):
            return {
                "stage": "task_planning",
                "spec_qa_report": result,
                "stage_history": _record_stage_exit(state, "spec_qa"),
                "messages": _append_message(
                    state, "assistant",
                    "Spec QA passed all checks. Building sprint plan.",
                ),
            }
        else:
            questions = result.get("clarification_questions", [])
            return {
                "stage": "spec_qa",
                "spec_qa_report": result,
                "pending_questions": questions[:3],
                "messages": _append_message(
                    state, "assistant",
                    f"Spec QA found {result.get('error_count', 0)} errors, "
                    f"{result.get('warning_count', 0)} warnings. "
                    "Please address the issues.",
                ),
            }
    except Exception as e:
        logger.exception("Spec QA node error")
        # Non-blocking: proceed to task planning
        return {
            "stage": "task_planning",
            "stage_history": _record_stage_exit(state, "spec_qa"),
            "messages": _append_message(
                state, "assistant",
                f"Spec QA encountered an issue ({e}), proceeding to task planning.",
            ),
        }


async def task_planning_node(state: NapkinState) -> dict:
    """Stage: Task Planning -- break spec into executable sprint plan."""
    spec = state.get("spec_object") or {}

    try:
        from app.services.agents.final.task_planner import run_task_planner
        result = await run_task_planner(spec)

        task_count = len(result.get("tasks", []))
        total_hours = result.get("total_hours", 0)

        # Store decision via memory agent
        try:
            from app.services.agents.final.memory import store_decision
            await store_decision(state, spec, result)
        except Exception:
            logger.debug("Memory store skipped")

        return {
            "stage": "export",
            "sprint_plan": result,
            "stage_history": _record_stage_exit(state, "task_planning"),
            "messages": _append_message(
                state, "assistant",
                f"Sprint plan created: {task_count} tasks, {total_hours}h total. "
                "Generating exports.",
            ),
        }
    except Exception as e:
        logger.exception("Task planning node error")
        # Non-blocking: proceed to export even without sprint plan
        return {
            "stage": "export",
            "stage_history": _record_stage_exit(state, "task_planning"),
            "messages": _append_message(
                state, "assistant",
                f"Task planning failed ({e}), proceeding to export.",
            ),
        }


async def done_node(state: NapkinState) -> dict:
    """Stage: Done -- session complete."""
    return {
        "stage": "done",
        "is_complete": True,
    }


async def error_node(state: NapkinState) -> dict:
    """Handle errors gracefully with retry logic."""
    error = state.get("error", "Unknown error")
    retry_count = state.get("retry_count", 0)

    if retry_count < MAX_RETRIES:
        return {
            "error": None,
            "retry_count": retry_count + 1,
            "messages": _append_message(
                state, "assistant",
                f"Hit an issue: {error}. Retrying (attempt {retry_count + 1}/{MAX_RETRIES})...",
            ),
        }
    else:
        return {
            "stage": "error",
            "is_complete": True,
            "messages": _append_message(
                state, "assistant",
                f"Session encountered an error after {MAX_RETRIES} retries: {error}. "
                "Please try starting a new session.",
            ),
        }


# ============================================================
# ROUTING FUNCTIONS (deterministic -- no LLM)
# ============================================================

def route_after_intake(state: NapkinState) -> str:
    """After intake: advance to synthesis if enough feedback, else END."""
    if state.get("stage") == "synthesis":
        return "synthesis"
    return END


def route_after_synthesis(state: NapkinState) -> str:
    """After synthesis: advance to prioritization if patterns found."""
    if state.get("stage") == "prioritization":
        return "prioritization"
    return END


def route_after_four_q(state: NapkinState) -> str:
    """After 4Q: advance to repo_context if all answered, else END."""
    if state.get("stage") == "repo_context":
        return "repo_context"
    return END


def route_after_spec(state: NapkinState) -> str:
    """After spec: advance to spec_qa if spec produced."""
    if state.get("stage") == "spec_qa":
        return "spec_qa"
    return END


def route_after_spec_qa(state: NapkinState) -> str:
    """After spec QA: advance to task_planning if passed, retry spec_building, or END."""
    if state.get("stage") == "task_planning":
        return "task_planning"
    # Content-based: retry spec_building if QA failed and retries remain
    spec_qa_report = state.get("spec_qa_report") or {}
    if not spec_qa_report.get("passed") and state.get("retry_count", 0) < 2:
        return "spec_building"
    return END


def route_stage(state: NapkinState) -> str:
    """Deterministic stage router for error recovery."""
    stage = state.get("stage", "intake")
    if stage in (
        "intake", "synthesis", "prioritization", "four_questions",
        "repo_context", "spec_building", "spec_qa", "task_planning",
        "export", "done",
    ):
        return stage
    return "intake"


# ============================================================
# BUILD THE GRAPH
# ============================================================

def build_session_graph() -> StateGraph:
    """
    Build the LangGraph state machine for a Napkin session.

    Flow:
        intake -> synthesis -> prioritization -> four_questions
            -> repo_context -> spec_building -> spec_qa -> task_planning
            -> done -> END
    """
    graph = StateGraph(NapkinState)

    # Add nodes
    graph.add_node("intake", intake_node)
    graph.add_node("synthesis", synthesis_node)
    graph.add_node("prioritization", prioritization_node)
    graph.add_node("four_questions", four_questions_node)
    graph.add_node("repo_context", repo_context_node)
    graph.add_node("spec_building", spec_building_node)
    graph.add_node("spec_qa", spec_qa_node)
    graph.add_node("task_planning", task_planning_node)
    graph.add_node("export", run_export)
    graph.add_node("done", done_node)
    graph.add_node("handle_error", error_node)

    # Entry point
    graph.set_entry_point("intake")

    # Conditional edges
    graph.add_conditional_edges(
        "intake",
        route_after_intake,
        {"synthesis": "synthesis", END: END},
    )

    graph.add_conditional_edges(
        "synthesis",
        route_after_synthesis,
        {"prioritization": "prioritization", END: END},
    )

    # Prioritization always advances to four_questions
    graph.add_edge("prioritization", "four_questions")

    graph.add_conditional_edges(
        "four_questions",
        route_after_four_q,
        {"repo_context": "repo_context", END: END},
    )

    # Repo context always advances to spec_building
    graph.add_edge("repo_context", "spec_building")

    graph.add_conditional_edges(
        "spec_building",
        route_after_spec,
        {"spec_qa": "spec_qa", END: END},
    )

    graph.add_conditional_edges(
        "spec_qa",
        route_after_spec_qa,
        {"task_planning": "task_planning", "spec_building": "spec_building", END: END},
    )

    # Task planning advances to export, then done
    graph.add_edge("task_planning", "export")
    graph.add_edge("export", "done")

    graph.add_edge("done", END)

    # Error handling
    graph.add_conditional_edges(
        "handle_error",
        lambda s: "done" if s.get("is_complete") else route_stage(s),
        {
            "done": "done",
            "intake": "intake",
            "synthesis": "synthesis",
            "prioritization": "prioritization",
            "four_questions": "four_questions",
            "repo_context": "repo_context",
            "spec_building": "spec_building",
            "spec_qa": "spec_qa",
            "task_planning": "task_planning",
            "export": "export",
        },
    )

    return graph


def compile_session_graph():
    """Compile the graph for execution."""
    return build_session_graph().compile()


# Singleton compiled graph
_compiled_graph = None


def get_session_graph():
    """Get the compiled session graph (singleton)."""
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = compile_session_graph()
    return _compiled_graph
