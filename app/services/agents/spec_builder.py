"""
Napkin — Spec & Prompt Builder
Produces the 6-section SpecObject + Cursor-ready prompt.
Direct pipeline: generate → validate (deterministic) → cursor prompt. No ReAct.
"""

import json

import structlog
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm import get_fast_llm, get_strong_llm, cached_system
from app.models.llm_outputs import SpecLLMOutput
from app.services.agents.prompts import (
    CURSOR_PROMPT_COMPILER,
    SPEC_BUILDER_SYSTEM,
    SPEC_BUILDER_USER,
)

logger = structlog.get_logger(__name__)


async def build_spec(
    pattern_report: dict,
    four_q: dict,
    priorities: dict | None = None,
    repo_context: dict | None = None,
) -> dict:
    """Build SpecObject + CursorPrompt. Three sequential phases, no ReAct."""
    llm = get_strong_llm()
    repo_context_str = _format_repo_context(repo_context or {})

    # Phase 1: Generate spec via structured output
    spec = await _generate_spec(llm, pattern_report, four_q, repo_context_str, repo_context)
    if spec is None:
        logger.error("spec_generation_failed")
        spec = _fallback_spec(pattern_report, four_q)

    # Phase 2: Deterministic validation
    lint_report = _deterministic_lint(spec)
    spec["ambiguity_score"] = lint_report.get("ambiguity_score", 0.0)

    # Phase 3: Generate cursor prompt
    cursor_prompt = await _generate_cursor_prompt(llm, spec, repo_context or {})
    spec["cursor_prompt"] = cursor_prompt

    logger.info(
        "spec_built",
        tasks=len(spec.get("task_breakdown", [])),
        errors=lint_report.get("error_count", 0),
    )
    return spec


async def _generate_spec(llm, pattern_report, four_q, repo_context_str, repo_context=None) -> dict | None:
    """Generate the spec via structured output."""
    structured_llm = llm.with_structured_output(SpecLLMOutput)

    try:
        business_ctx = repo_context_str  # repo_context dict may contain business_context key
        if isinstance(repo_context, dict) and repo_context.get("business_context"):
            business_ctx_data = repo_context["business_context"]
            business_ctx = json.dumps(business_ctx_data, indent=2, default=str)[:2000]
        else:
            business_ctx = "No business context available."

        result = await structured_llm.ainvoke([
            cached_system(SPEC_BUILDER_SYSTEM),
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
                business_context=business_ctx,
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


async def _generate_cursor_prompt(llm, spec: dict, repo_context: dict) -> str:
    """Generate Cursor-ready build prompt. Uses Haiku for speed (formatting task)."""
    try:
        fast_llm = get_fast_llm()
        response = await fast_llm.ainvoke([
            cached_system("You generate concise Cursor-ready build prompts. Keep it under 3000 words. Be specific but brief."),
            HumanMessage(content=CURSOR_PROMPT_COMPILER.format(
                spec_json=json.dumps(spec, indent=2, default=str)[:4000],
                repo_context=json.dumps(repo_context, indent=2, default=str)[:1000],
            )),
        ])
        return response.content
    except Exception as exc:
        logger.warning("cursor_prompt.error", error=str(exc))
        return "// Cursor prompt generation failed — review spec manually"


def _deterministic_lint(spec: dict) -> dict:
    """Deterministic quality checks on the spec."""
    issues = []

    required = {"decision", "ui_changes", "data_model", "task_breakdown", "success_criteria"}
    for section in required:
        value = spec.get(section)
        if value is None or value == "" or value == []:
            issues.append({"severity": "error", "message": f"Missing: {section}", "section": section})

    for task in spec.get("task_breakdown", []):
        if not task.get("acceptance_criteria") and not task.get("acceptance"):
            issues.append({
                "severity": "error",
                "message": f"Task '{task.get('title', '?')}' missing acceptance criteria",
                "section": "task_breakdown",
            })

    error_count = sum(1 for i in issues if i["severity"] == "error")
    warning_count = sum(1 for i in issues if i.get("severity") == "warning")

    return {
        "issues": issues,
        "passed": error_count == 0,
        "error_count": error_count,
        "warning_count": warning_count,
        "ambiguity_score": min(1.0, len(issues) * 0.1),
    }


def _format_repo_context(repo_snapshot: dict) -> str:
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


def _fallback_spec(pattern_report: dict, four_q: dict) -> dict:
    """Minimal spec when LLM generation fails."""
    top_pain = "Address top user pain"
    top_pains = pattern_report.get("top_pains", [])
    if top_pains:
        top_pain = top_pains[0] if isinstance(top_pains[0], str) else str(top_pains[0])

    return {
        "decision": {
            "what": f"Fix: {top_pain}",
            "why": "Highest severity issue from feedback analysis",
            "segment": four_q.get("q1_segment_jtbd", "Primary users"),
        },
        "ui_changes": [],
        "data_model": [],
        "task_breakdown": [{"title": top_pain, "type": "BE", "estimate_hours": 8}],
        "success_criteria": [{"metric": "User complaints reduced", "target": "50% reduction"}],
    }
