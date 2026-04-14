"""
Napkin — Context Inferrer (Autopilot Mode)
Auto-answers the 4 Socratic questions using business context, repo context,
and decision history. Used for auto-triggered sessions where no human is present.

Returns the same dict shape as infer_strategic_context() so the spec builder
receives identical input regardless of manual vs autopilot mode.
"""

from __future__ import annotations

import json

import structlog
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm import get_strong_llm, cached_system
from app.db.client import get_supabase_admin
from app.models.llm_outputs import StrategicContext

logger = structlog.get_logger(__name__)

INFERRER_SYSTEM = """You are Napkin's Context Inferrer. You auto-answer 4 strategic product questions
using all available context about the product, codebase, and past decisions.

Answer AS IF you were the product manager, using evidence from:
- Business context (what the product does, who it's for, pricing, competitors)
- Repo context (what's been built, stack, key entities, routes)
- Decision history (what was previously decided and shipped)
- The current feedback patterns (what users are saying NOW)

The 4 questions:
Q1 — SEGMENT + JTBD: Who is this for and what job are they hiring the product to do?
Q2 — SMALLEST PROOF: What's the smallest thing buildable in 2 weeks to prove this works?
Q3 — NON-GOALS: What are we explicitly NOT building? (3-5 concrete items)
Q4 — CONSTRAINTS & RISKS: Technical constraints, dependencies, or risks the builder should know?

Rules:
- Be SPECIFIC. "All users" is not a segment. "Make it better" is not a proof.
- Q2 must be genuinely buildable in 2 weeks — a proof of concept, not a full feature.
- Q3 must list concrete exclusions, not vague statements.
- Q4 must reference real technical details from the repo context when available.
- If context is missing for a question, state your assumption clearly."""


async def infer_autopilot_context(
    project_id: str,
    pattern_report: dict,
    priorities: dict,
) -> dict:
    """
    Auto-generate strategic context using all available project data.
    Returns the same shape as socratic.infer_strategic_context():
      {q1_segment_jtbd, q1_evidence, q2_smallest_proof, q2_scope_notes,
       q3_non_goals, q4_constraints, q4_risks, q4_dependencies}
    """
    db = get_supabase_admin()

    # Gather rich context
    business_ctx = _load_business_context(db, project_id)
    repo_ctx = _load_repo_context(db, project_id)
    decision_history = _load_decision_history(db, project_id)

    # Format pattern data (same as socratic.py)
    top_pains = pattern_report.get("top_pains", [])[:5]
    segments = pattern_report.get("segments_found", [])
    critical = pattern_report.get("critical_issues", [])[:3]
    opportunities = (priorities.get("opportunities") or [])[:3]

    # Build context block
    ctx_parts = []

    ctx_parts.append(f"Current feedback patterns:\n- Top pains: {json.dumps(top_pains, default=str)}")
    ctx_parts.append(f"- Segments found: {json.dumps(segments, default=str)}")
    if critical:
        ctx_parts.append(f"- Critical issues: {json.dumps([c.get('title', c.get('label', '')) for c in critical], default=str)}")
    if opportunities:
        ctx_parts.append(f"- Top opportunities: {json.dumps([o.get('title', '') for o in opportunities], default=str)}")

    if business_ctx:
        ctx_parts.append(f"\nBusiness context:")
        if business_ctx.get("product_name"):
            ctx_parts.append(f"  Product: {business_ctx['product_name']}")
        if business_ctx.get("core_value_prop"):
            ctx_parts.append(f"  Value prop: {business_ctx['core_value_prop']}")
        if business_ctx.get("target_customer"):
            ctx_parts.append(f"  Target customer: {business_ctx['target_customer']}")
        if business_ctx.get("key_features"):
            features = business_ctx["key_features"]
            if isinstance(features, list):
                ctx_parts.append(f"  Key features: {', '.join(features)}")
        if business_ctx.get("pricing_model"):
            ctx_parts.append(f"  Pricing: {business_ctx['pricing_model']}")

    if repo_ctx:
        ctx_parts.append(f"\nRepo context (what's been built):")
        if repo_ctx.get("stack"):
            ctx_parts.append(f"  Stack: {json.dumps(repo_ctx['stack'], default=str)}")
        if repo_ctx.get("entities"):
            ctx_parts.append(f"  Key entities: {json.dumps(repo_ctx['entities'], default=str)[:500]}")
        if repo_ctx.get("routes"):
            ctx_parts.append(f"  Routes: {json.dumps(repo_ctx['routes'], default=str)[:500]}")
        if repo_ctx.get("readme_content"):
            ctx_parts.append(f"  README: {repo_ctx['readme_content'][:500]}")

    if decision_history:
        ctx_parts.append(f"\nPast decisions ({len(decision_history)} recent):")
        for d in decision_history[:5]:
            ctx_parts.append(
                f"  - {d.get('summary', 'Decision')} "
                f"[{d.get('outcome_status', 'pending')}] "
                f"({d.get('created_at', '')[:10]})"
            )

    context_block = "\n".join(ctx_parts)

    # Call LLM with structured output (same model as socratic.py)
    llm = get_strong_llm()
    structured_llm = llm.with_structured_output(StrategicContext)

    try:
        result = await structured_llm.ainvoke([
            cached_system(INFERRER_SYSTEM),
            HumanMessage(content=f"""Using all the context below, answer the 4 strategic questions.

{context_block}

Answer each question with specific, actionable detail. Reference real data points."""),
        ])

        if isinstance(result, dict):
            out = result
        elif hasattr(result, "model_dump"):
            out = result.model_dump()
        else:
            out = {}

        out["_mode"] = "autopilot"
        out["_has_business_context"] = business_ctx is not None
        out["_has_repo_context"] = repo_ctx is not None
        out["_decision_count"] = len(decision_history)

        logger.info("autopilot_context_inferred", project_id=project_id,
                     has_business=business_ctx is not None,
                     has_repo=repo_ctx is not None,
                     decisions=len(decision_history))
        return out

    except Exception as exc:
        logger.error("autopilot_inference_failed", error=str(exc))
        # Fallback to the basic socratic inferrer
        from app.services.agents.socratic import infer_strategic_context
        result = await infer_strategic_context(pattern_report, priorities)
        result["_mode"] = "autopilot_fallback"
        return result


# ===================================================================
# Context Loaders
# ===================================================================

def _load_business_context(db, project_id: str) -> dict | None:
    """Load business context from business_contexts table."""
    try:
        result = (
            db.table("business_contexts")
            .select("product_name, core_value_prop, target_customer, key_features, pricing_model, competitors, tone")
            .eq("project_id", project_id)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None
    except Exception:
        return None


def _load_repo_context(db, project_id: str) -> dict | None:
    """Load repo context from repo_contexts table."""
    try:
        result = (
            db.table("repo_contexts")
            .select("stack, entities, routes, readme_content")
            .eq("project_id", project_id)
            .order("indexed_at", desc=True)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None
    except Exception:
        return None


def _load_decision_history(db, project_id: str) -> list[dict]:
    """Load recent decisions from decision_log table."""
    try:
        result = (
            db.table("decision_log")
            .select("summary, reasoning, outcome_status, outcome_notes, created_at")
            .eq("project_id", project_id)
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        return result.data or []
    except Exception:
        return []
