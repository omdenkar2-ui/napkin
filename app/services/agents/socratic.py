"""
Napkin — Strategic Context Inference
Infers segment, JTBD, scope, constraints, and risks from the data itself.
Replaces the interactive 4-question flow — no user round-trips needed.
Single LLM call with structured output.
"""

import json

import structlog
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm import get_strong_llm, cached_system
from app.models.llm_outputs import StrategicContext

logger = structlog.get_logger(__name__)


async def infer_strategic_context(pattern_report: dict, priorities: dict) -> dict:
    """Infer all strategic context from analysis data. Single LLM call."""
    llm = get_strong_llm()
    structured_llm = llm.with_structured_output(StrategicContext)

    top_pains = pattern_report.get("top_pains", [])[:5]
    segments = pattern_report.get("segments_found", [])
    critical = pattern_report.get("critical_issues", [])[:3]
    opportunities = (priorities.get("opportunities") or [])[:3]

    try:
        result = await structured_llm.ainvoke([
            cached_system("""You are a product strategist. Based on customer feedback analysis,
infer the strategic context that a development team needs to build the right thing.

Answer these 4 questions using ONLY evidence from the data:

1. q1_segment_jtbd: Who are the primary users and what job are they hiring this product for?
   q1_evidence: List 2-3 specific evidence points from the feedback.

2. q2_smallest_proof: What is the smallest thing buildable in 2 weeks that proves the top opportunity works?
   q2_scope_notes: What specifically is IN scope for this proof.

3. q3_non_goals: What should explicitly NOT be built? List 3-5 non-goals based on the data.

4. q4_constraints: Technical constraints apparent from the feedback.
   q4_risks: Risks to the build (technical, adoption, scope creep).
   q4_dependencies: External dependencies or prerequisites.

Be specific and actionable. No vague generalities."""),
            HumanMessage(content=(
                f"Top pains: {json.dumps(top_pains, default=str)}\n"
                f"Segments: {json.dumps(segments, default=str)}\n"
                f"Critical issues: {json.dumps(critical, default=str)[:3000]}\n"
                f"Top opportunities: {json.dumps(opportunities, default=str)[:3000]}\n\n"
                "Infer the strategic context."
            )),
        ])

        if hasattr(result, "model_dump"):
            ctx = result.model_dump()
        elif isinstance(result, dict):
            ctx = result
        else:
            ctx = {}

    except Exception as exc:
        logger.warning("context_inference_failed", error=str(exc))
        ctx = {
            "q1_segment_jtbd": f"Users experiencing: {top_pains[0] if top_pains else 'various issues'}",
            "q1_evidence": [str(p) for p in top_pains[:2]],
            "q2_smallest_proof": opportunities[0].get("title", "Address top pain point") if opportunities else "Fix top critical issue",
            "q2_scope_notes": "Focus on the single highest-impact change",
            "q3_non_goals": ["Large-scale refactoring", "New feature categories", "Platform migrations"],
            "q4_constraints": ["Existing architecture constraints"],
            "q4_risks": ["Scope creep"],
            "q4_dependencies": [],
        }

    ctx["is_complete"] = True
    logger.info("context_inferred", segment=ctx.get("q1_segment_jtbd", "")[:80])
    return ctx
