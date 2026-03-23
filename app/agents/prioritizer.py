"""
Napkin — Opportunity Prioritizer Agent (Agent 7)

Takes a PatternReport and generates 3-7 ranked opportunity candidates
using RICE scoring. Recommends the top pick with tradeoff explanations.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import UTC, datetime
from uuid import uuid4

logger = logging.getLogger(__name__)


async def run_prioritizer(
    pattern_report: dict,
    repo_context: dict | None = None,
    llm=None,
) -> dict:
    """
    Generate and RICE-score 3-7 opportunity candidates from patterns.

    Returns a DecisionObject-compatible dict.
    """
    clusters = pattern_report.get("clusters", [])
    top_pains = pattern_report.get("top_pains", [])
    segments = pattern_report.get("segments_found", [])
    contradictions = pattern_report.get("contradictions", [])

    if not clusters:
        return _empty_result()

    if llm is None:
        from app.core.llm import get_strong_llm
        llm = get_strong_llm()

    # Phase 1: Generate opportunity candidates via LLM
    from app.agents.prompts.prioritizer import PRIORITIZER_SYSTEM, PRIORITIZER_USER

    user_prompt = PRIORITIZER_USER.format(
        clusters=json.dumps(clusters, default=str),
        top_pains=json.dumps(top_pains),
        segments=json.dumps(segments),
        contradictions=json.dumps(contradictions, default=str),
    )

    try:
        response = await llm.ainvoke(f"{PRIORITIZER_SYSTEM}\n\n{user_prompt}")
        text = response.content if hasattr(response, "content") else str(response)
        parsed = _parse_json_object(text)
    except Exception:
        logger.exception("Prioritizer LLM call failed")
        return _fallback_from_clusters(clusters, top_pains, segments)

    if not parsed:
        return _fallback_from_clusters(clusters, top_pains, segments)

    # Phase 2: Extract opportunities and compute RICE scores deterministically
    raw_opportunities = parsed.get("opportunities", [])
    if not raw_opportunities:
        return _fallback_from_clusters(clusters, top_pains, segments)

    opportunities = []
    for opp in raw_opportunities[:7]:  # Cap at 7
        reach = max(0, int(opp.get("reach", 0)))
        impact = max(0.0, min(3.0, float(opp.get("impact", 0))))
        confidence = max(0.0, min(1.0, float(opp.get("confidence", 0))))
        effort = max(0.5, float(opp.get("effort_weeks", 1)))

        rice_score = (reach * impact * confidence) / effort

        opportunities.append({
            "id": str(uuid4())[:8],
            "title": opp.get("title", "Untitled"),
            "description": opp.get("description", ""),
            "source_patterns": opp.get("source_patterns", []),
            "segments_served": opp.get("segments_served", []),
            "reach": reach,
            "impact": impact,
            "confidence": confidence,
            "effort_weeks": effort,
            "rice_score": round(rice_score, 2),
            "rank": 0,
            "risks": opp.get("risks", []),
            "dependencies": opp.get("dependencies", []),
            "non_goals_if_chosen": opp.get("non_goals_if_chosen", []),
        })

    # Phase 3: Rank by RICE score descending
    opportunities.sort(key=lambda o: o["rice_score"], reverse=True)
    for i, opp in enumerate(opportunities):
        opp["rank"] = i + 1

    recommended = opportunities[0]["id"] if opportunities else None
    reasoning = parsed.get(
        "recommendation_reasoning",
        f"'{opportunities[0]['title']}' has the highest RICE score ({opportunities[0]['rice_score']})."
        if opportunities else "",
    )
    tradeoff = parsed.get(
        "tradeoff_summary",
        f"Not picking '{opportunities[1]['title']}' means deferring {opportunities[1].get('description', 'an alternative approach')}."
        if len(opportunities) > 1 else "No alternatives to compare.",
    )

    return {
        "opportunities": opportunities,
        "recommended": recommended,
        "recommendation_reasoning": reasoning,
        "tradeoff_summary": tradeoff,
        "generated_at": datetime.now(UTC).isoformat(),
    }


# ============================================================
# Helpers
# ============================================================

def _empty_result() -> dict:
    return {
        "opportunities": [],
        "recommended": None,
        "recommendation_reasoning": "No patterns available for prioritization.",
        "tradeoff_summary": "",
        "generated_at": datetime.now(UTC).isoformat(),
    }


def _fallback_from_clusters(
    clusters: list[dict],
    top_pains: list[str],
    segments: list[str],
) -> dict:
    """Build opportunities directly from clusters when LLM fails."""
    opportunities = []
    for i, cluster in enumerate(clusters[:5]):
        severity = float(cluster.get("severity", cluster.get("severity_score", 5)))
        confidence = float(cluster.get("confidence", 0.5))
        frequency = int(cluster.get("frequency", 1))

        rice_score = (frequency * (severity / 3) * confidence) / 2.0

        opportunities.append({
            "id": str(uuid4())[:8],
            "title": cluster.get("label", f"Opportunity {i + 1}"),
            "description": cluster.get("pain_summary", ""),
            "source_patterns": [cluster.get("label", "")],
            "segments_served": segments[:3],
            "reach": frequency,
            "impact": round(severity / 3, 1),
            "confidence": confidence,
            "effort_weeks": 2.0,
            "rice_score": round(rice_score, 2),
            "rank": 0,
            "risks": [],
            "dependencies": [],
            "non_goals_if_chosen": [],
        })

    opportunities.sort(key=lambda o: o["rice_score"], reverse=True)
    for i, opp in enumerate(opportunities):
        opp["rank"] = i + 1

    return {
        "opportunities": opportunities,
        "recommended": opportunities[0]["id"] if opportunities else None,
        "recommendation_reasoning": "Fallback ranking based on cluster severity and frequency.",
        "tradeoff_summary": "",
        "generated_at": datetime.now(UTC).isoformat(),
    }


def _parse_json_object(text: str) -> dict:
    """Parse a JSON object from LLM output, handling markdown blocks."""
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
