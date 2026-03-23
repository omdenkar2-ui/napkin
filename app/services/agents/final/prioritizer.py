"""
Napkin — Opportunity Prioritizer Agent (ReAct)

Takes a PatternReport and generates 3-7 ranked opportunity candidates
using RICE scoring. Uses ReAct for validation and quality checks.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from uuid import uuid4

import structlog
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool

from app.models.llm_outputs import OpportunityLLMResult
from app.services.agents.react import react_loop

logger = structlog.get_logger(__name__)


# ============================================================
# TOOLS — the LLM decides when to call these
# ============================================================

@tool
async def compute_rice_score(reach: int, impact: float, confidence: float, effort_weeks: float) -> dict:
    """Compute RICE score. Deterministic: (reach * impact * confidence) / max(effort, 0.5)."""
    reach = max(0, reach)
    impact = max(0.0, min(3.0, impact))
    confidence = max(0.0, min(1.0, confidence))
    effort = max(0.5, effort_weeks)
    score = (reach * impact * confidence) / effort
    return {"rice_score": round(score, 2)}


@tool
async def validate_rice_inputs(opportunity: dict) -> dict:
    """Validate RICE input fields for an opportunity. Deterministic."""
    issues = []
    if opportunity.get("reach", 0) <= 0:
        issues.append("reach must be > 0")
    if not (0 <= opportunity.get("impact", 0) <= 3):
        issues.append("impact must be 0-3")
    if not (0 <= opportunity.get("confidence", 0) <= 1):
        issues.append("confidence must be 0-1")
    if opportunity.get("effort_weeks", 0) < 0.5:
        issues.append("effort_weeks must be >= 0.5")
    return {"valid": len(issues) == 0, "issues": issues}


@tool
async def evaluate_ranking_quality(opportunities: list[dict]) -> dict:
    """Check quality of the opportunity ranking. Deterministic."""
    issues = []
    scores = [o.get("rice_score", 0) for o in opportunities]
    if len(set(scores)) == 1 and len(scores) > 1:
        issues.append("All RICE scores are identical — check inputs")
    titles = [o.get("title", "") for o in opportunities]
    if len(titles) != len(set(titles)):
        issues.append("Duplicate opportunity titles found")
    return {"issues": issues, "needs_iteration": len(issues) > 0}


# ============================================================
# MAIN FUNCTION
# ============================================================

PRIORITIZER_REACT_SYSTEM = """You are the Prioritizer validation agent.
Validate opportunity rankings using validate_rice_inputs and evaluate_ranking_quality.
When satisfied, respond with a summary."""


async def run_prioritizer(
    pattern_report: dict,
    repo_context: dict | None = None,
    llm: object | None = None,
) -> dict:
    """Generate and RICE-score 3-7 opportunity candidates from patterns."""
    clusters = pattern_report.get("clusters", [])
    top_pains = pattern_report.get("top_pains", [])
    segments = pattern_report.get("segments_found", [])
    contradictions = pattern_report.get("contradictions", [])

    if not clusters:
        return _empty_result()

    if llm is None:
        from app.core.llm import get_strong_llm
        llm = get_strong_llm()

    from app.agents.prompts.prioritizer import PRIORITIZER_SYSTEM, PRIORITIZER_USER

    user_prompt = PRIORITIZER_USER.format(
        clusters=json.dumps(clusters, default=str),
        top_pains=json.dumps(top_pains),
        segments=json.dumps(segments),
        contradictions=json.dumps(contradictions, default=str),
    )

    # Generate opportunities via structured output
    try:
        structured_llm = llm.with_structured_output(OpportunityLLMResult)
        result = await structured_llm.ainvoke([
            SystemMessage(content=PRIORITIZER_SYSTEM),
            HumanMessage(content=user_prompt),
        ])

        if isinstance(result, dict):
            parsed = result
        elif hasattr(result, "model_dump"):
            parsed = result.model_dump()
        else:
            parsed = {}
    except Exception:
        logger.exception("Prioritizer structured output failed")
        return _fallback_from_clusters(clusters, top_pains, segments)

    raw_opportunities = parsed.get("opportunities", [])
    if not raw_opportunities:
        return _fallback_from_clusters(clusters, top_pains, segments)

    # Compute RICE scores deterministically
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

    # Rank by RICE score descending
    opportunities.sort(key=lambda o: o["rice_score"], reverse=True)
    for i, opp in enumerate(opportunities):
        opp["rank"] = i + 1

    # Validate via ReAct (best-effort)
    try:
        react_messages = [
            SystemMessage(content=PRIORITIZER_REACT_SYSTEM),
            HumanMessage(content=f"Validate: {json.dumps(opportunities, default=str)[:4000]}"),
        ]
        await react_loop(llm, [validate_rice_inputs, evaluate_ranking_quality], react_messages, max_iterations=2)
    except Exception:
        pass

    recommended = opportunities[0]["id"] if opportunities else None
    reasoning = parsed.get(
        "recommendation_reasoning",
        f"'{opportunities[0]['title']}' has the highest RICE score ({opportunities[0]['rice_score']})."
        if opportunities else "",
    )
    tradeoff = parsed.get(
        "tradeoff_summary",
        f"Not picking '{opportunities[1]['title']}' means deferring "
        f"{opportunities[1].get('description', 'an alternative approach')}."
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
    """Return empty prioritization result."""
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
