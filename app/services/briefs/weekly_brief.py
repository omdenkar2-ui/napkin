"""
Weekly Brief Generator — Compiles the past 7 days of feedback analysis into a
single actionable digest with a ready-to-paste Cursor prompt.

The brief has 5 sections:
  1. This Week's Signal (volume, sources, sentiment)
  2. Top 3 Patterns (name, frequency, severity, one quote)
  3. Recommended Action (opinionated, specific)
  4. Cursor Prompt (ready to paste into Cursor/Claude Code)
  5. Resolved This Week (celebrate wins)
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import structlog
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm import get_strong_llm
from app.db.client import get_supabase_admin

logger = structlog.get_logger(__name__)


WEEKLY_BRIEF_SYSTEM = """You are Napkin's Weekly Brief compiler. Distill a week of feedback analysis
into a brief a busy founder reads in 2 minutes and acts on immediately.

Exactly 5 sections:

1. **THIS WEEK'S SIGNAL** (2-3 sentences)
   Feedback volume, sources, overall sentiment direction.

2. **TOP 3 PATTERNS** (bullet each)
   3 most important patterns across all sessions. Each: name, frequency, severity (0-10), one user quote.

3. **RECOMMENDED ACTION** (1 paragraph)
   What to build this week. Be specific and opinionated — say "Build X because Y", not "consider X."

4. **CURSOR PROMPT** (ready to paste)
   A complete prompt for Cursor/Claude Code that implements the recommended action.
   Reference real files/tables/routes from the repo context when available.
   Must be executable on first paste.

5. **RESOLVED THIS WEEK** (if any)
   Patterns that were addressed. Celebrate wins.

Rules:
- No filler, no "in conclusion", no "as we can see."
- Write like a cofounder sending a Monday morning Slack message.
- The Cursor prompt is the most important part — it must work on first paste.
- If data is sparse, say so briefly and still make a recommendation.

Output valid JSON:
{
  "subject": "Napkin Weekly — [key theme]",
  "signal_summary": "...",
  "top_patterns": [{"name": "...", "frequency": 0, "severity": 0, "quote": "..."}, ...],
  "recommended_action": "...",
  "cursor_prompt": "...",
  "resolved_this_week": ["...", ...]
}"""


async def generate_weekly_brief(project_id: str) -> dict:
    """Generate the weekly brief for a project."""
    db = get_supabase_admin()
    week_ago = (datetime.now(UTC) - timedelta(days=7)).isoformat()

    # 1. Sessions from past week
    sessions = (
        db.table("sessions")
        .select("id, title, stage, status, pattern_report, spec_object, created_at")
        .eq("project_id", project_id)
        .gte("created_at", week_ago)
        .order("created_at", desc=True)
        .execute()
    )
    session_list = sessions.data or []
    session_ids = [s["id"] for s in session_list]

    if not session_ids:
        return _empty_brief()

    # 2. Pattern clusters from these sessions
    patterns = (
        db.table("pattern_clusters")
        .select("label, description, pain_summary, frequency, severity_score, confidence, urgency, top_quotes, resolved")
        .in_("session_id", session_ids)
        .execute()
    )
    pattern_list = patterns.data or []

    # 3. Feedback item count + sources
    feedback = (
        db.table("feedback_items")
        .select("id, source_id", count="exact")
        .eq("project_id", project_id)
        .gte("created_at", week_ago)
        .execute()
    )
    item_count = feedback.count if hasattr(feedback, "count") else len(feedback.data or [])

    # Get source types from feedback_sources
    sources_set: set[str] = set()
    source_ids = list({f.get("source_id") for f in (feedback.data or []) if f.get("source_id")})
    if source_ids:
        src_result = (
            db.table("feedback_sources")
            .select("source_type")
            .in_("id", source_ids[:20])
            .execute()
        )
        sources_set = {s.get("source_type", "manual") for s in (src_result.data or [])}

    # 4. Resolved patterns this week
    resolved_labels = [
        p.get("label", "") for p in pattern_list if p.get("resolved")
    ]

    # 5. Repo context for Cursor prompt grounding
    repo_ctx = None
    try:
        repo_result = (
            db.table("repo_contexts")
            .select("stack, entities, routes, readme_content")
            .eq("project_id", project_id)
            .order("indexed_at", desc=True)
            .limit(1)
            .execute()
        )
        if repo_result.data:
            repo_ctx = repo_result.data[0]
    except Exception:
        pass

    # 6. Business context
    biz_ctx = None
    try:
        biz_result = (
            db.table("business_contexts")
            .select("product_name, core_value_prop, target_customer")
            .eq("project_id", project_id)
            .limit(1)
            .execute()
        )
        if biz_result.data:
            biz_ctx = biz_result.data[0]
    except Exception:
        pass

    # 7. Build LLM context
    context = {
        "sessions_count": len(session_list),
        "feedback_items": item_count,
        "sources": list(sources_set),
        "patterns": [
            {
                "label": p.get("label", ""),
                "description": p.get("description") or p.get("pain_summary") or "",
                "frequency": p.get("frequency", 0),
                "severity": p.get("severity_score", 0),
                "urgency": p.get("urgency", ""),
                "quotes": (p.get("top_quotes") or [])[:2],
            }
            for p in pattern_list if not p.get("resolved")
        ],
        "specs_generated": sum(1 for s in session_list if s.get("spec_object")),
        "resolved_patterns": resolved_labels,
        "product_name": (biz_ctx or {}).get("product_name", "your product"),
        "repo_context": {
            "stack": (repo_ctx or {}).get("stack"),
            "readme_snippet": ((repo_ctx or {}).get("readme_content") or "")[:500],
        } if repo_ctx else None,
    }

    # 8. Generate via Claude
    llm = get_strong_llm()

    try:
        response = await llm.ainvoke([
            SystemMessage(content=WEEKLY_BRIEF_SYSTEM),
            HumanMessage(content=f"Compile the weekly brief:\n\n{json.dumps(context, indent=2, default=str)}"),
        ])

        content = response.content if hasattr(response, "content") else str(response)
        content = content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1] if "\n" in content else content[3:]
        if content.endswith("```"):
            content = content[:-3]

        brief = json.loads(content.strip())

    except Exception as exc:
        logger.error("weekly_brief_llm_failed", error=str(exc))
        brief = _fallback_brief(context)

    # Add metadata
    brief["metadata"] = {
        "sessions_analyzed": len(session_ids),
        "feedback_items": item_count,
        "sources": list(sources_set),
        "generated_at": datetime.now(UTC).isoformat(),
        "project_id": project_id,
    }

    # 9. Store as artifact
    try:
        db.table("napkin_artifacts").insert({
            "id": str(uuid4()),
            "project_id": project_id,
            "title": brief.get("subject", "Napkin Weekly Brief"),
            "summary": brief.get("signal_summary", ""),
            "milestone_type": "custom",
            "render_data": brief,
            "is_public": False,
        }).execute()
    except Exception as exc:
        logger.warning("weekly_brief_artifact_save_failed", error=str(exc))

    logger.info("weekly_brief_generated", project_id=project_id,
                 sessions=len(session_ids), items=item_count)
    return brief


async def format_brief_for_slack(brief: dict) -> str:
    """Format the weekly brief as a Slack message (Block Kit-compatible text)."""
    if brief.get("error"):
        return f"Failed to generate weekly brief: {brief['error']}"

    lines = []
    lines.append(f"*{brief.get('subject', 'Napkin Weekly Brief')}*")
    lines.append("")

    lines.append("*This week's signal*")
    lines.append(brief.get("signal_summary", "No data."))
    lines.append("")

    patterns = brief.get("top_patterns", [])
    if patterns:
        lines.append("*Top patterns*")
        for p in patterns:
            lines.append(
                f"  *{p.get('name', '')}* — {p.get('frequency', '?')}x, "
                f"severity {p.get('severity', '?')}/10"
            )
            if p.get("quote"):
                lines.append(f'  _{p["quote"]}_')
        lines.append("")

    lines.append("*Recommended action*")
    lines.append(brief.get("recommended_action", ""))
    lines.append("")

    prompt = brief.get("cursor_prompt", "")
    if prompt:
        lines.append("*Cursor prompt* (paste into Cursor)")
        lines.append(f"```{prompt[:3000]}```")

    resolved = brief.get("resolved_this_week", [])
    if resolved:
        lines.append("")
        lines.append("*Resolved this week*")
        for r in resolved:
            lines.append(f"  {r}")

    meta = brief.get("metadata", {})
    lines.append("")
    lines.append(
        f"_Analyzed {meta.get('sessions_analyzed', 0)} sessions, "
        f"{meta.get('feedback_items', 0)} items from "
        f"{', '.join(meta.get('sources', ['manual']))}._"
    )

    return "\n".join(lines)


def _empty_brief() -> dict:
    """Return a brief for weeks with no activity."""
    return {
        "subject": "Napkin Weekly — Quiet week",
        "signal_summary": (
            "No new feedback sessions this week. Either your scrapers aren't connected "
            "or your users are silent (which might itself be a signal)."
        ),
        "top_patterns": [],
        "recommended_action": (
            "Check that your feedback sources (Gmail, Intercom, GitHub Issues) "
            "are connected and syncing in Settings > Integrations."
        ),
        "cursor_prompt": "",
        "resolved_this_week": [],
        "metadata": {"sessions_analyzed": 0, "feedback_items": 0, "sources": []},
    }


def _fallback_brief(context: dict) -> dict:
    """Deterministic fallback if LLM fails."""
    patterns = context.get("patterns", [])
    top = sorted(patterns, key=lambda p: -(p.get("severity", 0)))[:3]

    return {
        "subject": f"Napkin Weekly — {len(patterns)} patterns found",
        "signal_summary": (
            f"{context.get('feedback_items', 0)} feedback items from "
            f"{', '.join(context.get('sources', ['manual']))} across "
            f"{context.get('sessions_count', 0)} sessions."
        ),
        "top_patterns": [
            {
                "name": p.get("label", "Unknown"),
                "frequency": p.get("frequency", 0),
                "severity": p.get("severity", 0),
                "quote": (p.get("quotes", [None])[0] or {}).get("text", "") if p.get("quotes") else "",
            }
            for p in top
        ],
        "recommended_action": f"Address the top pattern: {top[0].get('label', 'unknown')}" if top else "No patterns found.",
        "cursor_prompt": "",
        "resolved_this_week": context.get("resolved_patterns", []),
    }
