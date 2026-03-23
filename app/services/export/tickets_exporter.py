"""
Converts final pipeline state into sprint-ready ticket JSON.
Compatible with both Linear and Jira import formats.
No LLM calls — fully deterministic from state data.
"""
from __future__ import annotations


def export_tickets(state: dict) -> list[dict]:
    """
    Generate one ticket per prioritized feature.
    Returns list of ticket dicts with Linear and Jira
    compatible formats.
    """
    tickets = []

    features = state.get("prioritized_features", [])
    spec = state.get("spec", {})
    pattern_cards = {
        p.get("pattern_id"): p
        for p in state.get("pattern_cards", [])
    }
    spec_sections = {
        s.get("feature_id", s.get("title", "")): s
        for s in spec.get("features", [])
    }

    for feature in features:
        pid = feature.get("pattern_id", "")
        pattern = pattern_cards.get(pid, {})
        spec_section = spec_sections.get(pid, {})

        rice_score = feature.get("rice_score", 0)
        effort = feature.get("effort_weeks", feature.get("effort", 1))

        priority_label = _rice_to_priority(rice_score)
        effort_label = _effort_to_tshirt(effort)
        source_count = len(pattern.get("source_item_ids", []))
        acceptance_criteria = spec_section.get("acceptance_criteria", [])
        description = _build_description(pattern, spec_section, source_count)
        labels = _infer_labels(spec_section)

        ticket = {
            "title": pattern.get(
                "name", spec_section.get("title", f"Feature {pid}")
            ),
            "description": description,
            "acceptance_criteria": acceptance_criteria,
            "effort_estimate": effort_label,
            "priority": priority_label,
            "labels": labels,
            "linked_patterns": [pattern.get("name", pid)],
            "source_feedback_count": source_count,
            "rice_score": rice_score,
            "linear_compatible": {
                "title": pattern.get("name", f"Feature {pid}"),
                "description": description,
                "priority": _priority_to_linear_int(priority_label),
                "estimate": _tshirt_to_linear_points(effort_label),
                "labelNames": labels,
            },
            "jira_compatible": {
                "summary": pattern.get("name", f"Feature {pid}"),
                "description": description,
                "issuetype": "Story",
                "priority": _priority_to_jira(priority_label),
                "labels": labels,
                "story_points": _tshirt_to_story_points(effort_label),
            },
        }
        tickets.append(ticket)

    return tickets


def _build_description(
    pattern: dict, spec_section: dict, source_count: int
) -> str:
    parts = []
    if pattern.get("description"):
        parts.append(f"**Background**\n{pattern['description']}")
    if source_count:
        parts.append(f"*Driven by {source_count} feedback items.*")
    if pattern.get("confidence"):
        conf_pct = int(pattern["confidence"] * 100)
        parts.append(f"*Pattern confidence: {conf_pct}%*")
    if spec_section.get("description"):
        parts.append(f"**What to build**\n{spec_section['description']}")
    return "\n\n".join(parts) if parts else "No description available."


def _infer_labels(spec_section: dict) -> list[str]:
    labels = []
    text = str(spec_section).lower()
    if any(k in text for k in ["api", "endpoint", "route", "backend"]):
        labels.append("backend")
    if any(k in text for k in ["ui", "frontend", "component", "screen"]):
        labels.append("frontend")
    if any(k in text for k in ["database", "schema", "table", "migration"]):
        labels.append("data")
    if any(k in text for k in ["auth", "permission", "role"]):
        labels.append("auth")
    return labels if labels else ["feature"]


def _rice_to_priority(rice_score: float) -> str:
    if rice_score >= 80:
        return "urgent"
    if rice_score >= 50:
        return "high"
    if rice_score >= 20:
        return "medium"
    return "low"


def _effort_to_tshirt(effort_weeks: float) -> str:
    if effort_weeks <= 0.5:
        return "XS"
    if effort_weeks <= 1:
        return "S"
    if effort_weeks <= 2:
        return "M"
    if effort_weeks <= 4:
        return "L"
    return "XL"


def _priority_to_linear_int(priority: str) -> int:
    return {"urgent": 1, "high": 2, "medium": 3, "low": 4}.get(priority, 3)


def _priority_to_jira(priority: str) -> str:
    return {
        "urgent": "Highest", "high": "High",
        "medium": "Medium", "low": "Low",
    }.get(priority, "Medium")


def _tshirt_to_linear_points(size: str) -> int:
    return {"XS": 1, "S": 2, "M": 3, "L": 5, "XL": 8}.get(size, 3)


def _tshirt_to_story_points(size: str) -> int:
    return {"XS": 1, "S": 2, "M": 5, "L": 8, "XL": 13}.get(size, 5)
