"""
Napkin — Opportunity Prioritizer
Generates 3-7 ranked opportunity candidates with RICE scoring.
Single LLM call + deterministic scoring. No ReAct.
"""

import json
from datetime import UTC, datetime
from uuid import uuid4

import structlog
from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.prompts.prioritizer import PRIORITIZER_SYSTEM, PRIORITIZER_USER
from app.models.llm_outputs import OpportunityLLMResult

logger = structlog.get_logger(__name__)


async def run_prioritizer(
    pattern_report: dict,
    repo_context: dict | None = None,
    llm: object | None = None,
) -> dict:
    """Generate and RICE-score 3-7 opportunity candidates."""
    clusters = pattern_report.get("clusters", [])
    top_pains = pattern_report.get("top_pains", [])
    segments = pattern_report.get("segments_found", [])
    contradictions = pattern_report.get("contradictions", [])

    if not clusters:
        return _empty_result()

    if llm is None:
        from app.core.llm import get_fast_llm
        llm = get_fast_llm()

    # Single LLM call for opportunity generation (Haiku — structured output task)
    try:
        structured_llm = llm.with_structured_output(OpportunityLLMResult)
        result = await structured_llm.ainvoke([
            SystemMessage(content=PRIORITIZER_SYSTEM),
            HumanMessage(content=PRIORITIZER_USER.format(
                clusters=json.dumps(clusters, default=str),
                top_pains=json.dumps(top_pains),
                segments=json.dumps(segments),
                contradictions=json.dumps(contradictions, default=str),
            )),
        ])

        parsed = result.model_dump() if hasattr(result, "model_dump") else (result if isinstance(result, dict) else {})
    except Exception:
        logger.exception("prioritizer_llm_failed")
        return _fallback_from_clusters(clusters, top_pains, segments)

    raw_opportunities = parsed.get("opportunities", [])
    if not raw_opportunities:
        return _fallback_from_clusters(clusters, top_pains, segments)

    # Deterministic RICE scoring
    opportunities = []
    for opp in raw_opportunities[:7]:
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
        f"Not picking '{opportunities[1]['title']}' defers {opportunities[1].get('description', 'an alternative')}."
        if len(opportunities) > 1 else "No alternatives to compare.",
    )

    logger.info("prioritization_complete", opportunities=len(opportunities), top=recommended)

    return {
        "opportunities": opportunities,
        "recommended": recommended,
        "recommendation_reasoning": reasoning,
        "tradeoff_summary": tradeoff,
        "generated_at": datetime.now(UTC).isoformat(),
    }


def _empty_result() -> dict:
    return {
        "opportunities": [],
        "recommended": None,
        "recommendation_reasoning": "No patterns available for prioritization.",
        "tradeoff_summary": "",
        "generated_at": datetime.now(UTC).isoformat(),
    }


def _fallback_from_clusters(clusters, top_pains, segments) -> dict:
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
