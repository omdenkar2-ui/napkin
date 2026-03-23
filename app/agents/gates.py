"""
Napkin Backend — Quality Gates

All gates are deterministic pure functions. No LLM calls, no DB calls,
no side effects. They take state (or parts of it) and return GateCheck objects.

Gates enforce minimum quality thresholds between pipeline stages:
- Evidence gate: enough diverse feedback before synthesis
- Pattern quality gate: clusters are grounded in evidence
- Constraint completeness gate: all 4 strategic questions answered
- Ambiguity gate: spec is complete and cursor prompt is clean
"""

from __future__ import annotations

import logging

from app.models.session_state import (
    FourQAnswers,
    GateCheck,
    GateResults,
    SessionState,
)

logger = logging.getLogger(__name__)

# Banned vague words in cursor prompts — these signal ambiguity.
BANNED_PROMPT_WORDS = {"improve", "optimize", "enhance", "better"}


def check_evidence_gate(signals: list[dict]) -> GateCheck:
    """
    Gate 1: Evidence Threshold (run after Intake).

    Passes if:
    - At least 3 signals extracted
    - At least 2 unique segments or source labels
    """
    blockers: list[str] = []

    if len(signals) < 3:
        blockers.append(
            f"Need at least 3 feedback items (got {len(signals)}). "
            "Please paste more customer feedback."
        )

    # Collect unique segments and sources for diversity check
    segments = {s.get("segment_guess") for s in signals if s.get("segment_guess")}
    sources = {s.get("source_label") for s in signals if s.get("source_label")}
    diverse_count = len(segments | sources)

    if diverse_count < 2 and len(signals) >= 3:
        blockers.append(
            "Need more diverse sources — at least 2 unique segments or source labels."
        )

    passed = len(blockers) == 0
    return GateCheck(
        name="evidence",
        passed=passed,
        details=f"{len(signals)} signals, {len(segments)} segments, {len(sources)} sources",
        blockers=blockers,
    )


def check_pattern_quality_gate(pattern_report: dict | None) -> GateCheck:
    """
    Gate 2: Pattern Quality (run after Synthesis).

    Passes if:
    - At least 2 clusters found
    - Every cluster has at least 1 evidence quote
    - top_pains list is non-empty
    """
    if not pattern_report:
        return GateCheck(
            name="pattern_quality",
            passed=False,
            details="No pattern report produced",
            blockers=["Synthesis produced no pattern report."],
        )

    blockers: list[str] = []
    clusters = pattern_report.get("clusters", [])

    if len(clusters) < 2:
        blockers.append(
            f"Need at least 2 theme clusters (got {len(clusters)})."
        )

    for cluster in clusters:
        label = cluster.get("label", "unknown")
        quotes = cluster.get("evidence_quotes", [])
        if not quotes:
            blockers.append(f'Cluster "{label}" has no evidence quotes.')

    top_pains = pattern_report.get("top_pains", [])
    if not top_pains:
        blockers.append("No top pains ranked — synthesis must identify priority pains.")

    passed = len(blockers) == 0
    return GateCheck(
        name="pattern_quality",
        passed=passed,
        details=f"{len(clusters)} clusters, {len(top_pains)} top pains",
        blockers=blockers,
    )


def check_constraint_gate(four_q: dict | None) -> GateCheck:
    """
    Gate 3: Constraint Completeness (run after Four Questions).

    Passes if all 4 questions are answered (FourQAnswers.is_complete).
    """
    if not four_q:
        return GateCheck(
            name="constraint_completeness",
            passed=False,
            details="No four-question answers provided",
            blockers=["None of the 4 strategic questions have been answered."],
        )

    answers = FourQAnswers(**four_q)
    blockers: list[str] = []

    if not answers.q1_segment_jtbd:
        blockers.append("Q1 (segment + JTBD) not answered.")
    if not answers.q2_smallest_proof:
        blockers.append("Q2 (smallest proof) not answered.")
    if not answers.q3_non_goals:
        blockers.append("Q3 (non-goals) not answered.")
    if not answers.q4_constraints and not answers.q4_risks:
        blockers.append("Q4 (constraints & risks) not answered.")

    passed = answers.is_complete
    return GateCheck(
        name="constraint_completeness",
        passed=passed,
        details=f"{answers.answered_count()}/4 questions answered",
        blockers=blockers,
    )


def check_ambiguity_gate(spec: dict | None) -> GateCheck:
    """
    Gate 4: Ambiguity + Grounding (run after Spec Building).

    Passes if:
    - Spec has all 6 required sections with content
    - cursor_prompt is non-empty
    - No banned vague words in cursor_prompt
    """
    if not spec:
        return GateCheck(
            name="ambiguity",
            passed=False,
            details="No spec object produced",
            blockers=["Spec builder produced no output."],
        )

    blockers: list[str] = []

    # Check required sections
    required = {
        "decision": "Decision section",
        "ui_changes": "UI changes section",
        "data_model": "Data model section",
        "task_breakdown": "Task breakdown section",
        "success_criteria": "Success criteria section",
        "cursor_prompt": "Cursor prompt",
    }
    for key, label in required.items():
        value = spec.get(key)
        if not value:
            blockers.append(f"{label} is missing or empty.")

    # Check cursor prompt for banned words
    cursor_prompt = spec.get("cursor_prompt", "")
    if cursor_prompt:
        prompt_lower = cursor_prompt.lower()
        found_banned = [w for w in BANNED_PROMPT_WORDS if w in prompt_lower]
        if found_banned:
            blockers.append(
                f"Cursor prompt contains vague words: {', '.join(found_banned)}. "
                "Be more specific."
            )

    passed = len(blockers) == 0
    return GateCheck(
        name="ambiguity",
        passed=passed,
        details=f"Checked {len(required)} sections",
        blockers=blockers,
    )


def run_gates(state: SessionState) -> GateResults:
    """
    Run all applicable quality gates based on the current stage.

    Gates are cumulative — later stages include earlier gates:
    - After intake: evidence gate only
    - After synthesis: evidence + pattern quality
    - After four_questions: evidence + pattern + constraint
    - After spec_building: all four gates
    """
    stage = state.get("stage", "intake")
    results = GateResults()

    signals = state.get("signals", [])
    pattern_report = state.get("pattern_report")
    four_q = state.get("four_q_answers")
    spec = state.get("spec_object")

    if stage in ("intake", "synthesis", "four_questions", "spec_building", "done"):
        results.evidence = check_evidence_gate(signals)

    if stage in ("synthesis", "four_questions", "spec_building", "done"):
        results.pattern_quality = check_pattern_quality_gate(pattern_report)

    if stage in ("four_questions", "spec_building", "done"):
        results.constraint_completeness = check_constraint_gate(four_q)

    if stage in ("spec_building", "done"):
        results.ambiguity = check_ambiguity_gate(spec)

    return results
