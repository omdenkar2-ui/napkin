"""
Napkin — Decision Log & Memory Service (Agent 9)

Stores decisions at session end, retrieves relevant past decisions at
session start, and tracks outcomes for cross-session learning.

Uses in-memory storage for MVP. Supabase persistence is future work.
Note: This is a stateful service, not an LLM-powered agent.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import uuid4

logger = logging.getLogger(__name__)

# In-memory store: project_id -> list of DecisionRecord dicts
_memory_store: dict[str, list[dict]] = {}


async def store_decision(
    session_state: dict,
    spec: dict,
    task_plan: dict | None = None,
) -> dict:
    """
    Create a DecisionRecord from session outputs and store it.

    Returns the created DecisionRecord dict.
    """
    project_id = session_state.get("project_id", "unknown")
    session_id = session_state.get("session_id", str(uuid4()))

    four_q = session_state.get("four_q_answers") or {}
    pattern_report = session_state.get("pattern_report") or {}
    prioritization = session_state.get("prioritization_result") or {}

    decision = spec.get("decision") or {}
    decision_summary = decision.get("what", "")
    if decision.get("why"):
        decision_summary += f" -- {decision['why']}"

    top_patterns = pattern_report.get("top_pains", [])

    chosen = prioritization.get("recommended")
    rejected = []
    for opp in prioritization.get("opportunities", []):
        opp_id = opp.get("id", "")
        if opp_id and opp_id != chosen:
            rejected.append(opp.get("title", opp_id))

    record = {
        "id": str(uuid4()),
        "project_id": project_id,
        "session_id": session_id,
        "created_at": datetime.now(UTC).isoformat(),
        "decision_summary": decision_summary,
        "spec_title": decision.get("what", ""),
        "chosen_opportunity": chosen,
        "rejected_alternatives": rejected,
        "top_patterns": top_patterns,
        "segments": pattern_report.get("segments_found", []),
        "constraints": four_q.get("q4_constraints", []),
        "non_goals": four_q.get("q3_non_goals", []),
        "outcome_status": "pending",
        "outcome_notes": None,
        "outcome_date": None,
        "learnings": [],
    }

    if project_id not in _memory_store:
        _memory_store[project_id] = []
    _memory_store[project_id].append(record)

    logger.info(
        "Decision stored",
        extra={"project_id": project_id, "session_id": session_id},
    )
    return record


async def retrieve_context(
    project_id: str,
    current_patterns: list[str] | None = None,
    memory_store: dict[str, list[dict]] | None = None,
) -> dict:
    """
    Retrieve relevant past decisions for the current session.

    Returns dict with: relevant_decisions, known_constraints, known_non_goals, suggestions.
    """
    store = memory_store if memory_store is not None else _memory_store
    records = store.get(project_id, [])

    if not records:
        return {
            "relevant_decisions": [],
            "known_constraints": [],
            "known_non_goals": [],
            "suggestions": [],
        }

    if current_patterns:
        pattern_set = {p.lower() for p in current_patterns}

        def relevance_score(record: dict) -> int:
            """Score by keyword overlap with current patterns."""
            record_patterns = {p.lower() for p in record.get("top_patterns", [])}
            return len(pattern_set & record_patterns)

        ranked = sorted(records, key=relevance_score, reverse=True)
    else:
        ranked = sorted(records, key=lambda r: r.get("created_at", ""), reverse=True)

    relevant = ranked[:3]

    all_constraints: list[str] = []
    all_non_goals: list[str] = []
    for r in records:
        all_constraints.extend(r.get("constraints", []))
        all_non_goals.extend(r.get("non_goals", []))

    known_constraints = list(dict.fromkeys(all_constraints))
    known_non_goals = list(dict.fromkeys(all_non_goals))

    suggestions: list[str] = []
    for r in records:
        if r.get("outcome_status") == "failed" and r.get("learnings"):
            for learning in r["learnings"]:
                suggestions.append(
                    f"Past learning from '{r.get('spec_title', 'unknown')}': {learning}"
                )
        if r.get("outcome_status") == "failed" and r.get("outcome_notes"):
            suggestions.append(
                f"Previous attempt '{r.get('spec_title', '')}' failed: "
                f"{r['outcome_notes']}"
            )

    return {
        "relevant_decisions": relevant,
        "known_constraints": known_constraints,
        "known_non_goals": known_non_goals,
        "suggestions": suggestions[:5],
    }


async def record_outcome(
    decision_id: str,
    shipped: bool,
    notes: str | None = None,
    memory_store: dict[str, list[dict]] | None = None,
) -> dict:
    """
    Record the outcome of a past decision.

    Returns the updated DecisionRecord dict, or empty dict if not found.
    """
    store = memory_store if memory_store is not None else _memory_store

    for records in store.values():
        for record in records:
            if record.get("id") == decision_id:
                record["outcome_status"] = "shipped" if shipped else "failed"
                record["outcome_notes"] = notes
                record["outcome_date"] = datetime.now(UTC).isoformat()

                if notes and not shipped:
                    record["learnings"].append(notes)

                logger.info(
                    "Outcome recorded",
                    extra={
                        "decision_id": decision_id,
                        "outcome": record["outcome_status"],
                    },
                )
                return record

    logger.warning("Decision not found", extra={"decision_id": decision_id})
    return {}


def clear_memory_store() -> None:
    """Clear the in-memory store. Used for testing."""
    _memory_store.clear()
