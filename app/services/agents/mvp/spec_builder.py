"""
Napkin — MVP Agent: Spec & Prompt Builder (ReAct)
Produces the 6-section SpecObject + Cursor-ready prompt.
Uses ReAct loop for validation and self-critique.
"""

from __future__ import annotations

import json

import structlog
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool

from app.core.llm import get_strong_llm
from app.models.llm_outputs import SpecLLMOutput
from app.services.agents.prompts import (
    CURSOR_PROMPT_COMPILER,
    SPEC_BUILDER_SYSTEM,
    SPEC_BUILDER_USER,
)
from app.services.agents.react import react_loop

logger = structlog.get_logger(__name__)


# ============================================================
# TOOLS — the LLM decides when to call these
# ============================================================

@tool
async def validate_section(section_name: str, section_data: dict) -> dict:
    """Validate a single spec section for issues. Deterministic."""
    issues = []

    if section_name == "task_breakdown":
        tasks = section_data if isinstance(section_data, list) else section_data.get("tasks", [])
        for i, task in enumerate(tasks):
            if not task.get("acceptance_criteria") and not task.get("acceptance"):
                issues.append(f"Task '{task.get('title', f'#{i+1}')}' has no acceptance criteria")
            if not task.get("title"):
                issues.append(f"Task #{i+1} has no title")

    elif section_name == "decision":
        if not section_data.get("what"):
            issues.append("Decision missing 'what' field")
        if not section_data.get("why"):
            issues.append("Decision missing 'why' field")
        if not section_data.get("evidence_refs"):
            issues.append("Decision missing evidence_refs")

    elif section_name == "success_criteria":
        criteria = section_data if isinstance(section_data, list) else []
        if len(criteria) > 3:
            issues.append(f"Too many success criteria ({len(criteria)}), max is 3")

    return {"section": section_name, "issues": issues, "valid": len(issues) == 0}


@tool
async def check_spec_coherence(spec: dict) -> dict:
    """Check cross-section coherence of the spec. Deterministic."""
    issues = []

    valid_types = {"FE", "BE", "DB", "INFRA", "TEST"}
    for task in spec.get("task_breakdown", []):
        task_type = task.get("type", "").upper()
        if task_type and task_type not in valid_types:
            issues.append(f"Task '{task.get('title', '?')}' has invalid type '{task_type}'")

    banned = {"improve", "optimize", "enhance", "better", "fix", "update"}
    cursor_prompt = str(spec.get("cursor_prompt", "")).lower()
    found_banned = banned & set(cursor_prompt.split())
    if found_banned:
        issues.append(f"Cursor prompt contains vague words: {', '.join(sorted(found_banned))}")

    required = {"decision", "ui_changes", "data_model", "task_breakdown", "success_criteria"}
    for section in required:
        value = spec.get(section)
        if value is None or value == "" or value == []:
            issues.append(f"Missing required section: {section}")

    return {"coherent": len(issues) == 0, "issues": issues}


@tool
async def lookup_repo_entity(name: str, repo_snapshot: dict) -> dict:
    """Search repo entities for a matching entity name."""
    for entity in repo_snapshot.get("entities", []):
        if entity.get("name", "").lower() == name.lower():
            return {"found": True, "entity": entity}
    return {"found": False, "message": f"Entity '{name}' not found in repo"}


@tool
async def lookup_repo_route(path: str, repo_snapshot: dict) -> dict:
    """Search repo routes for a matching path."""
    for route in repo_snapshot.get("routes", []):
        if route.get("path", "").lower() == path.lower():
            return {"found": True, "route": route}
    return {"found": False, "message": f"Route '{path}' not found in repo"}


# ============================================================
# MAIN NODE — LangGraph entry point
# ============================================================

SPEC_REACT_SYSTEM = """You are the Spec Builder validation agent.
Check the spec using validate_section and check_spec_coherence tools.
Fix any issues you find. When satisfied, respond with a summary."""


async def spec_builder_node(state: dict) -> dict:
    """LangGraph node: Build SpecObject + CursorPrompt via ReAct."""
    pattern_report = state.get("pattern_report", {})
    four_q = state.get("four_q_answers", {})
    repo_snapshot = state.get("repo_snapshot") or {}
    messages = state.get("messages", [])

    if not pattern_report:
        return {
            "error": "Cannot build spec without pattern report",
            "messages": messages + [{
                "role": "assistant",
                "content": "Need pattern analysis first.",
            }],
        }

    if not four_q.get("is_complete"):
        return {
            "error": "Cannot build spec without completing 4 strategic questions",
            "messages": messages + [{
                "role": "assistant",
                "content": "Please complete the 4 questions first.",
            }],
        }

    llm = get_strong_llm()
    repo_context_str = _format_repo_context(repo_snapshot)

    # Phase 1: Generate spec via structured output
    spec_object = await _generate_spec(llm, pattern_report, four_q, repo_context_str)

    if spec_object is None:
        return {
            "error": "Spec generation failed",
            "retry_count": state.get("retry_count", 0) + 1,
            "messages": messages + [{
                "role": "assistant",
                "content": "I had trouble generating the spec. Retrying...",
            }],
        }

    # Phase 2: Validate and refine via ReAct
    await _validate_react(llm, spec_object, repo_snapshot)

    # Phase 3: Generate cursor prompt
    cursor_prompt = await _generate_cursor_prompt(llm, spec_object, repo_snapshot)
    spec_object["cursor_prompt"] = cursor_prompt

    # Phase 4: Deterministic lint
    lint_report = _deterministic_lint(spec_object)
    spec_object["ambiguity_score"] = lint_report.get("ambiguity_score", 0.0)

    return {
        "spec_object": spec_object,
        "lint_report": lint_report,
        "messages": messages + [{
            "role": "assistant",
            "content": _format_spec_summary(spec_object, lint_report),
        }],
    }


# ============================================================
# INTERNAL FLOWS
# ============================================================

async def _generate_spec(llm, pattern_report, four_q, repo_context_str) -> dict | None:
    """Generate the initial spec via structured output."""
    structured_llm = llm.with_structured_output(SpecLLMOutput)

    try:
        result = await structured_llm.ainvoke([
            SystemMessage(content=SPEC_BUILDER_SYSTEM),
            HumanMessage(content=SPEC_BUILDER_USER.format(
                pattern_report=json.dumps(pattern_report, indent=2, default=str)[:6000],
                q1=four_q.get("q1_segment_jtbd", "Not answered"),
                q2=four_q.get("q2_smallest_proof", "Not answered"),
                q3=json.dumps(four_q.get("q3_non_goals", []), default=str),
                q4=json.dumps({
                    "constraints": four_q.get("q4_constraints", []),
                    "risks": four_q.get("q4_risks", []),
                    "dependencies": four_q.get("q4_dependencies", []),
                }, default=str),
                repo_context=repo_context_str,
            )),
        ])

        if isinstance(result, dict):
            return result
        if hasattr(result, "model_dump"):
            return result.model_dump()
        return None
    except Exception as exc:
        logger.warning("spec_generation.error", error=str(exc))
        return None


async def _validate_react(llm, spec_object: dict, repo_snapshot: dict) -> None:
    """Use ReAct to validate the spec."""
    tools = [validate_section, check_spec_coherence]

    react_messages = [
        SystemMessage(content=SPEC_REACT_SYSTEM),
        HumanMessage(content=(
            f"Validate this spec:\n{json.dumps(spec_object, default=str)[:6000]}"
        )),
    ]

    try:
        await react_loop(llm, tools, react_messages, max_iterations=3)
    except Exception as exc:
        logger.warning("spec_validation.error", error=str(exc))


async def _generate_cursor_prompt(llm, spec_object: dict, repo_snapshot: dict) -> str:
    """Generate cursor prompt via direct LLM call."""
    try:
        response = await llm.ainvoke([
            SystemMessage(content="You generate Cursor-ready build prompts."),
            HumanMessage(content=CURSOR_PROMPT_COMPILER.format(
                spec_json=json.dumps(spec_object, indent=2, default=str)[:6000],
                repo_context=json.dumps(repo_snapshot, indent=2, default=str)[:2000],
            )),
        ])
        return response.content
    except Exception as exc:
        logger.warning("cursor_prompt.error", error=str(exc))
        return "// Cursor prompt generation failed — review spec manually"


def _deterministic_lint(spec_object: dict) -> dict:
    """Run deterministic lint checks on the spec."""
    issues = []

    required = {"decision", "ui_changes", "data_model", "task_breakdown", "success_criteria"}
    for section in required:
        value = spec_object.get(section)
        if value is None or value == "" or value == []:
            issues.append({"severity": "error", "message": f"Missing: {section}", "section": section})

    for task in spec_object.get("task_breakdown", []):
        if not task.get("acceptance_criteria") and not task.get("acceptance"):
            issues.append({
                "severity": "error",
                "message": f"Task '{task.get('title', '?')}' missing acceptance criteria",
                "section": "task_breakdown",
            })

    cursor_prompt = str(spec_object.get("cursor_prompt", "")).lower()
    banned = {"improve", "optimize", "enhance", "better", "fix", "update"}
    found = banned & set(cursor_prompt.split())
    if found:
        issues.append({
            "severity": "warning",
            "message": f"Vague words: {', '.join(sorted(found))}",
            "section": "cursor_prompt",
        })

    error_count = sum(1 for i in issues if i["severity"] == "error")
    warning_count = sum(1 for i in issues if i["severity"] == "warning")

    return {
        "issues": issues,
        "passed": error_count == 0,
        "error_count": error_count,
        "warning_count": warning_count,
        "ambiguity_score": min(1.0, len(issues) * 0.1),
    }


# ============================================================
# HELPERS
# ============================================================

def _format_repo_context(repo_snapshot: dict) -> str:
    """Format repo snapshot for prompt inclusion."""
    if not repo_snapshot:
        return "No repo context available. Spec will be based on general best practices."

    parts = []
    if repo_snapshot.get("readme"):
        parts.append(f"README:\n{repo_snapshot['readme'][:1000]}")
    if repo_snapshot.get("schema_text"):
        parts.append(f"SCHEMA:\n{repo_snapshot['schema_text'][:1000]}")
    if repo_snapshot.get("routes_text"):
        parts.append(f"ROUTES:\n{repo_snapshot['routes_text'][:1000]}")
    if repo_snapshot.get("stack_guess"):
        parts.append(f"STACK: {json.dumps(repo_snapshot['stack_guess'])}")

    return "\n\n".join(parts) if parts else "No repo context available."


def _format_spec_summary(spec_object: dict, lint_report: dict) -> str:
    """Create a human-readable summary of the generated spec."""
    decision = spec_object.get("decision", {})
    tasks = spec_object.get("task_breakdown", [])
    metrics = spec_object.get("success_criteria", [])
    errors = lint_report.get("error_count", 0)
    warnings = lint_report.get("warning_count", 0)

    summary = f"""**Spec Generated**

**What:** {decision.get('what', 'N/A')}
**Why:** {decision.get('why', 'N/A')}
**Segment:** {decision.get('segment', 'N/A')}

**Tasks:** {len(tasks)} items ({_count_by_type(tasks)})
**Success Metrics:** {len(metrics)}
**Quality:** {errors} errors, {warnings} warnings | \
Ambiguity: {lint_report.get('ambiguity_score', 'N/A')}

Cursor prompt is ready. Review the spec and approve to finalize."""

    return summary


def _count_by_type(tasks: list[dict]) -> str:
    """Count tasks by FE/BE/DB type."""
    counts: dict[str, int] = {}
    for t in tasks:
        task_type = t.get("type", "OTHER")
        counts[task_type] = counts.get(task_type, 0) + 1
    return ", ".join(f"{k}: {v}" for k, v in counts.items())
