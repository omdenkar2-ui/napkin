"""
Napkin — Spec QA / Ambiguity Killer Agent (ReAct)

Hard quality gatekeeper that reviews generated specs with 5 checks.
Can BLOCK output and generate clarification questions.
Uses ReAct loop when LLM is available; deterministic-only when not.
"""

from __future__ import annotations

import json
import re

import structlog
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool

from app.services.agents.react import react_loop

logger = structlog.get_logger(__name__)

_BANNED_WORDS = {"improve", "optimize", "enhance", "better", "fix", "update"}
_REQUIRED_SECTIONS = {
    "decision", "ui_changes", "data_model",
    "task_breakdown", "success_criteria", "cursor_prompt",
}


# ============================================================
# TOOLS — wrapped check functions for ReAct
# ============================================================

@tool
async def check_completeness(spec: dict) -> dict:
    """Check all 6 sections present, tasks have acceptance_criteria. Deterministic."""
    issues = []
    score = 1.0
    deduction = 1.0 / max(len(_REQUIRED_SECTIONS), 1)

    for section in _REQUIRED_SECTIONS:
        value = spec.get(section)
        if value is None or value == "" or value == []:
            issues.append({
                "severity": "error",
                "category": "completeness",
                "message": f"Missing required section: {section}",
                "section": section,
                "suggestion": f"Add the '{section}' section to the spec.",
            })
            score -= deduction

    tasks = spec.get("task_breakdown", [])
    for i, task_item in enumerate(tasks):
        criteria = task_item.get("acceptance_criteria", task_item.get("acceptance", []))
        if not criteria:
            issues.append({
                "severity": "error",
                "category": "completeness",
                "message": f"Task '{task_item.get('title', f'#{i+1}')}' has no acceptance criteria",
                "section": "task_breakdown",
                "suggestion": "Add at least 1 acceptance criterion to every task.",
            })
            score -= 0.05

    decision = spec.get("decision", {})
    if not decision.get("evidence_refs"):
        issues.append({
            "severity": "warning",
            "category": "completeness",
            "message": "Decision section has no evidence_refs",
            "section": "decision",
            "suggestion": "Reference specific pattern clusters that support this decision.",
        })
        score -= 0.1

    criteria_list = spec.get("success_criteria", [])
    if len(criteria_list) > 3:
        issues.append({
            "severity": "warning",
            "category": "completeness",
            "message": f"Too many success criteria ({len(criteria_list)}). Max is 3.",
            "section": "success_criteria",
            "suggestion": "Reduce to the 3 most important measurable metrics.",
        })
        score -= 0.1

    cursor_prompt = str(spec.get("cursor_prompt", "")).lower()
    found_banned = _BANNED_WORDS & set(cursor_prompt.split())
    if found_banned:
        issues.append({
            "severity": "error",
            "category": "completeness",
            "message": f"Cursor prompt contains vague words: {', '.join(sorted(found_banned))}",
            "section": "cursor_prompt",
            "suggestion": "Replace vague words with specific, actionable instructions.",
        })
        score -= 0.2

    return {"score": max(0.0, min(1.0, score)), "issues": issues}


@tool
async def check_consistency(spec: dict) -> dict:
    """Cross-reference UI, data model, and tasks. Deterministic."""
    issues = []
    score = 1.0

    ui_changes = spec.get("ui_changes", [])
    for ui in ui_changes:
        screen = ui.get("screen", "")
        if not screen:
            issues.append({
                "severity": "warning",
                "category": "consistency",
                "message": "UI change has no screen name",
                "section": "ui_changes",
                "suggestion": "Specify which screen/page this change applies to.",
            })
            score -= 0.1

    valid_types = {"FE", "BE", "DB", "INFRA", "TEST", "fe", "be", "db", "infra", "test"}
    for task in spec.get("task_breakdown", []):
        task_type = task.get("type", "")
        if task_type and task_type not in valid_types:
            issues.append({
                "severity": "warning",
                "category": "consistency",
                "message": f"Task '{task.get('title', '?')}' has invalid type '{task_type}'",
                "section": "task_breakdown",
                "suggestion": "Use one of: FE, BE, DB, INFRA, TEST.",
            })
            score -= 0.1

    return {"score": max(0.0, min(1.0, score)), "issues": issues}


@tool
async def check_repo_grounding(spec: dict, repo_context: dict) -> dict:
    """If repo context exists, verify file/entity refs exist. Deterministic."""
    if not repo_context:
        return {"score": 1.0, "issues": []}

    issues = []
    score = 1.0
    repo_entities = {
        e.get("name", "").lower()
        for e in repo_context.get("entities", [])
    }
    repo_tree = {p.lower() for p in repo_context.get("file_tree", [])}

    cursor_prompt = spec.get("cursor_prompt", "")
    file_refs = re.findall(r'[\w/\\]+\.\w{1,5}', cursor_prompt)
    for ref in file_refs:
        if ref.lower() not in repo_tree and not any(ref.lower() in t for t in repo_tree):
            issues.append({
                "severity": "warning",
                "category": "grounding",
                "message": f"File reference '{ref}' not found in repo",
                "section": "cursor_prompt",
                "suggestion": f"Verify '{ref}' exists or update the path.",
            })
            score -= 0.1

    for item in spec.get("data_model", []):
        entity = item.get("entity", "").lower()
        action = item.get("action", "")
        if entity and action == "modify" and entity not in repo_entities:
            issues.append({
                "severity": "warning",
                "category": "grounding",
                "message": f"Entity '{entity}' marked as 'modify' but not found in repo",
                "section": "data_model",
                "suggestion": f"Check if '{entity}' exists or change action to 'create'.",
            })
            score -= 0.15

    return {"score": max(0.0, min(1.0, score)), "issues": issues}


@tool
async def check_executability(spec: dict) -> dict:
    """Check that cursor_prompt is step-by-step executable. Deterministic."""
    cursor_prompt = spec.get("cursor_prompt", "")
    if not cursor_prompt:
        return {"score": 0.0, "issues": []}

    issues = []
    score = 1.0

    has_steps = bool(re.search(r"step\s+\d+", cursor_prompt, re.IGNORECASE))
    has_verify = "verify" in cursor_prompt.lower()

    if not has_steps:
        issues.append({
            "severity": "warning",
            "category": "executability",
            "message": "Cursor prompt lacks numbered steps",
            "section": "cursor_prompt",
            "suggestion": "Structure the prompt as numbered steps (Step 1, Step 2, etc.).",
        })
        score -= 0.3

    if not has_verify:
        issues.append({
            "severity": "warning",
            "category": "executability",
            "message": "Cursor prompt lacks verification steps",
            "section": "cursor_prompt",
            "suggestion": "Add 'Verify:' lines after key steps.",
        })
        score -= 0.2

    return {"score": max(0.0, min(1.0, score)), "issues": issues}


@tool
async def generate_fix_suggestions(issues: list[dict]) -> dict:
    """Generate fix suggestions for error-level issues. Deterministic."""
    suggestions = []
    for issue in issues:
        if issue.get("severity") == "error":
            suggestions.append({
                "issue": issue.get("message", ""),
                "fix": issue.get("suggestion", "Review and fix this issue."),
            })
    return {"suggestions": suggestions}


@tool
async def prioritize_issues(issues: list[dict]) -> dict:
    """Sort issues by severity: error > warning > info. Deterministic."""
    severity_order = {"error": 0, "warning": 1, "info": 2}
    sorted_issues = sorted(issues, key=lambda i: severity_order.get(i.get("severity", "info"), 2))
    return {"ranked_issues": sorted_issues}


# ============================================================
# MAIN FUNCTION
# ============================================================

SPEC_QA_REACT_SYSTEM = """You are the Spec QA agent.
Run all quality checks on the spec using the available tools:
- check_completeness, check_consistency, check_repo_grounding, check_executability
- prioritize_issues, generate_fix_suggestions
Run all checks, then summarize findings."""


async def run_spec_qa(
    spec: dict,
    four_q_answers: dict,
    repo_context: dict | None = None,
    llm: object | None = None,
) -> dict:
    """Hard quality review of a generated spec."""
    all_issues: list[dict] = []

    # Run deterministic checks directly (always available, even without LLM)
    completeness_result = await check_completeness.ainvoke({"spec": spec})
    completeness_score = completeness_result.get("score", 1.0)
    all_issues.extend(completeness_result.get("issues", []))

    consistency_result = await check_consistency.ainvoke({"spec": spec})
    consistency_score = consistency_result.get("score", 1.0)
    all_issues.extend(consistency_result.get("issues", []))

    grounding_result = await check_repo_grounding.ainvoke({"spec": spec, "repo_context": repo_context or {}})
    grounding_score = grounding_result.get("score", 1.0)
    all_issues.extend(grounding_result.get("issues", []))

    executability_result = await check_executability.ainvoke({"spec": spec})
    executability_score = executability_result.get("score", 1.0)
    all_issues.extend(executability_result.get("issues", []))

    # LLM-powered edge case check via ReAct (when LLM available)
    edge_case_score = 0.8
    if llm is not None:
        try:
            from app.services.agents.prompts import SPEC_QA_SYSTEM, SPEC_QA_USER

            from app.core.llm import cached_system
            react_messages = [
                cached_system(SPEC_QA_REACT_SYSTEM),
                HumanMessage(content=(
                    f"Check this spec for edge cases, auth issues, and error handling gaps.\n\n"
                    f"Spec: {json.dumps(spec, default=str)[:8000]}"
                )),
            ]

            tools = [generate_fix_suggestions, prioritize_issues]
            await react_loop(llm, tools, react_messages, max_iterations=3)
        except Exception:
            logger.exception("Edge case ReAct check failed")

    error_count = sum(1 for i in all_issues if i["severity"] == "error")
    warning_count = sum(1 for i in all_issues if i["severity"] == "warning")
    passed = error_count == 0

    clarification_questions = _generate_clarifications(all_issues)

    return {
        "passed": passed,
        "issues": all_issues,
        "clarification_questions": clarification_questions,
        "error_count": error_count,
        "warning_count": warning_count,
        "scores": {
            "completeness": completeness_score,
            "consistency": consistency_score,
            "grounding": grounding_score,
            "executability": executability_score,
        },
    }


# ============================================================
# Clarification Generation
# ============================================================

def _generate_clarifications(issues: list[dict]) -> list[str]:
    """Generate 0-3 clarification questions from error-level issues."""
    questions: list[str] = []
    error_issues = [i for i in issues if i["severity"] == "error"]

    for issue in error_issues[:3]:
        category = issue.get("category", "")
        message = issue.get("message", "")

        if category == "completeness" and "missing" in message.lower():
            section = issue.get("section", "")
            questions.append(
                f"The spec is missing the '{section}' section. Can you provide details for it?"
            )
        elif category == "completeness" and "acceptance criteria" in message.lower():
            questions.append(
                "Some tasks lack acceptance criteria. How should we verify they're done?"
            )
        elif category == "completeness" and "vague words" in message.lower():
            questions.append(
                "The cursor prompt uses vague words. Can you describe specifically what should change?"
            )
        else:
            questions.append(f"Issue found: {message}. Can you clarify?")

    return questions[:3]
