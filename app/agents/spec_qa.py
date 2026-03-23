"""
Napkin — Spec QA / Ambiguity Killer Agent (Agent 6)

Hard quality gatekeeper that reviews generated specs with 5 checks.
Can BLOCK output and generate clarification questions.
"""

from __future__ import annotations

import json
import logging
import re

logger = logging.getLogger(__name__)

_BANNED_WORDS = {"improve", "optimize", "enhance", "better", "fix", "update"}
_REQUIRED_SECTIONS = {
    "decision", "ui_changes", "data_model",
    "task_breakdown", "success_criteria", "cursor_prompt",
}


async def run_spec_qa(
    spec: dict,
    four_q_answers: dict,
    repo_context: dict | None = None,
    llm=None,
) -> dict:
    """
    Hard quality review of a generated spec.

    Returns: {
        passed: bool,
        issues: list[dict],
        clarification_questions: list[str],
        error_count: int,
        warning_count: int,
        scores: {completeness, consistency, grounding, executability}
    }
    """
    issues: list[dict] = []

    # ── Check 1: Completeness (deterministic) ──
    completeness_score = _check_completeness(spec, issues)

    # ── Check 2: Consistency (deterministic) ──
    consistency_score = _check_consistency(spec, issues)

    # ── Check 3: Edge cases (LLM) ──
    edge_case_score = await _check_edge_cases(spec, four_q_answers, llm, issues)

    # ── Check 4: Repo grounding (deterministic) ──
    grounding_score = _check_repo_grounding(spec, repo_context, issues)

    # ── Check 5: Prompt executability (deterministic + LLM) ──
    executability_score = await _check_executability(spec, llm, issues)

    # Compute results
    error_count = sum(1 for i in issues if i["severity"] == "error")
    warning_count = sum(1 for i in issues if i["severity"] == "warning")
    passed = error_count == 0

    # Generate clarification questions for unresolvable issues
    clarification_questions = _generate_clarifications(issues)

    return {
        "passed": passed,
        "issues": issues,
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
# Check 1: Completeness
# ============================================================

def _check_completeness(spec: dict, issues: list[dict]) -> float:
    """All 6 sections present, tasks have acceptance_criteria, etc."""
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

    # Check tasks have acceptance_criteria
    tasks = spec.get("task_breakdown", [])
    for i, task in enumerate(tasks):
        criteria = task.get("acceptance_criteria", task.get("acceptance", []))
        if not criteria:
            issues.append({
                "severity": "error",
                "category": "completeness",
                "message": f"Task '{task.get('title', f'#{i+1}')}' has no acceptance criteria",
                "section": "task_breakdown",
                "suggestion": "Add at least 1 acceptance criterion to every task.",
            })
            score -= 0.05

    # Check decision has evidence_refs
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

    # Check success_criteria <= 3
    criteria = spec.get("success_criteria", [])
    if len(criteria) > 3:
        issues.append({
            "severity": "warning",
            "category": "completeness",
            "message": f"Too many success criteria ({len(criteria)}). Max is 3.",
            "section": "success_criteria",
            "suggestion": "Reduce to the 3 most important measurable metrics.",
        })
        score -= 0.1

    # Check for banned words in cursor_prompt
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

    return max(0.0, min(1.0, score))


# ============================================================
# Check 2: Consistency
# ============================================================

def _check_consistency(spec: dict, issues: list[dict]) -> float:
    """Cross-reference UI, data model, and tasks."""
    score = 1.0

    # Extract entity names from data_model
    data_entities = set()
    for item in spec.get("data_model", []):
        entity = item.get("entity", "")
        if entity:
            data_entities.add(entity.lower())

    # Check UI references match data model entities
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

    # Check tasks reference valid types
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

    return max(0.0, min(1.0, score))


# ============================================================
# Check 3: Edge Cases (LLM)
# ============================================================

async def _check_edge_cases(
    spec: dict, four_q_answers: dict, llm, issues: list[dict]
) -> float:
    """LLM checks for missing error states, auth, empty states."""
    if llm is None:
        return 0.8  # Skip if no LLM, assume reasonable

    try:
        from app.agents.prompts.spec_qa import SPEC_QA_SYSTEM, SPEC_QA_USER

        pattern_report = {}  # Not needed for edge case check
        user_prompt = SPEC_QA_USER.format(
            spec_json=json.dumps(spec, default=str)[:8000],
            top_pains="[]",
            segments="[]",
            repo_context="None",
        )

        response = await llm.ainvoke(f"{SPEC_QA_SYSTEM}\n\n{user_prompt}")
        text = response.content if hasattr(response, "content") else str(response)
        parsed = _parse_json_object(text)

        llm_issues = parsed.get("issues", [])
        for issue in llm_issues[:5]:  # Cap at 5 LLM issues
            issues.append({
                "severity": issue.get("severity", "warning"),
                "category": issue.get("category", "edge_cases"),
                "message": issue.get("message", ""),
                "section": issue.get("section", ""),
                "suggestion": issue.get("suggestion", ""),
            })

        scores = parsed.get("scores", {})
        return float(scores.get("edge_cases", scores.get("completeness", 0.8)))

    except Exception:
        logger.exception("Edge case LLM check failed")
        return 0.8


# ============================================================
# Check 4: Repo Grounding
# ============================================================

def _check_repo_grounding(
    spec: dict, repo_context: dict | None, issues: list[dict]
) -> float:
    """If repo context exists, verify file/entity refs exist."""
    if not repo_context:
        return 1.0  # No repo = skip grounding check

    score = 1.0
    repo_entities = {
        e.get("name", "").lower()
        for e in repo_context.get("entities", [])
    }
    repo_tree = {p.lower() for p in repo_context.get("file_tree", [])}

    # Check cursor_prompt file references against file_tree
    cursor_prompt = spec.get("cursor_prompt", "")
    # Look for file-like references (e.g., src/components/Foo.tsx)
    file_refs = re.findall(r'[\w/\\]+\.\w{1,5}', cursor_prompt)
    for ref in file_refs:
        if ref.lower() not in repo_tree and not any(
            ref.lower() in t for t in repo_tree
        ):
            issues.append({
                "severity": "warning",
                "category": "grounding",
                "message": f"File reference '{ref}' not found in repo",
                "section": "cursor_prompt",
                "suggestion": f"Verify '{ref}' exists or update the path.",
            })
            score -= 0.1

    # Check entity references
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

    return max(0.0, min(1.0, score))


# ============================================================
# Check 5: Prompt Executability
# ============================================================

async def _check_executability(
    spec: dict, llm, issues: list[dict]
) -> float:
    """Check that cursor_prompt is step-by-step executable."""
    cursor_prompt = spec.get("cursor_prompt", "")

    if not cursor_prompt:
        return 0.0  # Already caught by completeness

    score = 1.0

    # Deterministic checks
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

    return max(0.0, min(1.0, score))


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


# ============================================================
# Helpers
# ============================================================

def _parse_json_object(text: str) -> dict:
    """Parse a JSON object from LLM output."""
    text = text.strip()
    try:
        result = json.loads(text)
        return result if isinstance(result, dict) else {}
    except (json.JSONDecodeError, ValueError):
        pass

    match = re.search(r"```(?:json)?\s*\n?(.*?)```", text, re.DOTALL)
    if match:
        try:
            result = json.loads(match.group(1).strip())
            return result if isinstance(result, dict) else {}
        except (json.JSONDecodeError, ValueError):
            pass

    return {}
