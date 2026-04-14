"""
Napkin — Ask Napkin RAG Engine
Retrieves from: sessions, feedback signals, patterns, specs, decisions.
Answers grounded in the user's actual product data.
"""

import json
import re
import structlog

from datetime import datetime, UTC
from uuid import uuid4

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.core.llm import cached_system, get_strong_llm
from app.db.client import get_supabase_admin

logger = structlog.get_logger(__name__)

SYSTEM_PROMPT = """You are Napkin's product memory assistant. You help PMs query and understand their own product feedback history, patterns, specs, and decisions.

You have access to the user's data retrieved from their Napkin workspace. Use ONLY this data to answer questions. If the data doesn't contain the answer, say so clearly — never fabricate information about their product.

When answering:
1. Be specific — reference actual session dates, pattern names, spec titles, and decision statuses
2. Use direct quotes from feedback when relevant (show them in "quotes")
3. If asked about trends, compare across multiple sessions
4. If asked about counts or frequencies, be precise with numbers
5. Always tell the user which sessions your answer comes from so they can dig deeper
6. If the query is ambiguous, answer your best interpretation and suggest a clarifying follow-up
7. Use markdown formatting: bold for emphasis, bullet lists for multiple items, headers for sections
8. When referencing severity scores, use descriptive labels too (e.g. "severity 8/10 — CRITICAL")"""


# ======================================================================
# Public API
# ======================================================================

async def chat(
    project_id: str,
    user_id: str,
    message: str,
    session_id: str | None = None,
) -> dict:
    """
    Process a chat message: retrieve relevant data, generate grounded response.

    Pipeline:
      1. Save user message to chat_messages
      2. Extract keywords from question
      3. Multi-source retrieval (sessions, specs, decisions, feedback)
      4. Assemble context with keyword-relevance boosting
      5. Call Claude with full context + conversation history
      6. Save and return response with source references + data summary
    """
    db = get_supabase_admin()
    project_id = str(project_id)
    user_id = str(user_id)
    chat_session_id = str(session_id) if session_id else str(uuid4())

    # 1. Save user message
    _save_message(db, project_id, user_id, chat_session_id, "user", message)

    # 2. Retrieve context (the RAG part)
    context = _retrieve_context(db, project_id, message)

    # 3. Load conversation history for multi-turn
    history = _load_chat_history(db, project_id, limit=20)

    # 4. Build LLM messages
    system_content = SYSTEM_PROMPT
    if context["has_data"]:
        system_content += "\n\n" + _format_context(context)
    else:
        system_content += (
            "\n\nNo feedback data has been analyzed yet for this project. "
            "Let the PM know they should run a feedback analysis session first."
        )

    messages = [cached_system(system_content)]
    for msg in history:
        content = msg.get("content", "")
        if msg.get("role") == "user":
            messages.append(HumanMessage(content=content))
        elif msg.get("role") == "assistant":
            messages.append(AIMessage(content=content))

    # Ensure current message is the last one
    if not messages or not isinstance(messages[-1], HumanMessage):
        messages.append(HumanMessage(content=message))

    # 5. Call Claude
    llm = get_strong_llm()
    try:
        response = await llm.ainvoke(messages)
        answer = response.content if hasattr(response, "content") else str(response)
    except Exception as exc:
        logger.error("ask_napkin.llm_failed", error=str(exc))
        answer = "I'm sorry, I encountered an error processing your request. Please try again."

    # 6. Build metadata and save
    metadata = {
        "referenced_sessions": context["source_session_ids"],
        "data_summary": {
            "sessions_searched": context["sessions_count"],
            "feedback_items_searched": context["feedback_count"],
            "specs_found": context["specs_count"],
            "decisions_found": context["decisions_count"],
        },
        "keywords_used": context["keywords"],
    }

    _save_message(db, project_id, user_id, chat_session_id, "assistant", answer, metadata)

    logger.info(
        "ask_napkin.response",
        project_id=project_id,
        sessions_searched=context["sessions_count"],
        feedback_items=context["feedback_count"],
        specs=context["specs_count"],
        keywords=context["keywords"],
    )

    return {
        "role": "assistant",
        "content": answer,
        "session_id": chat_session_id,
        "metadata": metadata,
    }


async def get_chat_history(project_id: str, limit: int = 50) -> list[dict]:
    """Fetch chat messages for a project, ordered chronologically."""
    db = get_supabase_admin()
    try:
        result = (
            db.table("chat_messages")
            .select("id, project_id, user_id, session_id, role, content, metadata, created_at")
            .eq("project_id", str(project_id))
            .order("created_at", desc=False)
            .limit(limit)
            .execute()
        )
        return result.data or []
    except Exception as exc:
        logger.error("ask_napkin.get_history_failed", error=str(exc))
        return []


# ======================================================================
# RAG Retrieval
# ======================================================================

def _retrieve_context(db, project_id: str, question: str) -> dict:
    """
    Multi-source retrieval from the user's workspace.
    Searches: sessions (with pattern_reports), specs, decisions, raw feedback.
    Boosts results that match keywords from the question.
    """
    keywords = _extract_keywords(question)

    context = {
        "sessions": [],
        "patterns": [],
        "specs": [],
        "decisions": [],
        "feedback_signals": [],
        "business_context": None,
        "repo_context": None,
        "source_session_ids": [],
        "keywords": keywords,
        "has_data": False,
        "sessions_count": 0,
        "feedback_count": 0,
        "specs_count": 0,
        "decisions_count": 0,
    }

    try:
        # ── 1. Sessions with pattern reports ──────────────────────
        sessions = _query_sessions(db, project_id)
        context["sessions_count"] = len(sessions)

        if sessions:
            context["has_data"] = True

            # Extract all patterns from sessions
            for s in sessions:
                sid = s.get("id", "")
                title = s.get("title", "Untitled")
                stage = s.get("stage", "")
                created = s.get("created_at", "")
                pr = s.get("pattern_report") or {}
                spec = s.get("spec_object") or {}
                decision = s.get("decision_object") or {}
                task_plan = s.get("task_plan") or {}

                session_info = {
                    "id": sid,
                    "title": title,
                    "stage": stage,
                    "created_at": created,
                }

                # Score relevance to keywords
                session_text = json.dumps(s, default=str).lower()
                relevance = sum(1 for kw in keywords if kw in session_text)
                session_info["relevance"] = relevance

                # Extract patterns
                clusters = []
                for key in ("critical_issues", "valuable_insights", "future_opportunities", "clusters"):
                    items = pr.get(key, [])
                    if isinstance(items, list):
                        for item in items:
                            cluster = {
                                "label": item.get("title") or item.get("label") or "Unknown",
                                "description": item.get("description") or item.get("pain_summary") or "",
                                "severity": item.get("severity") or item.get("severity_score") or "N/A",
                                "frequency": item.get("frequency") or "N/A",
                                "confidence": item.get("confidence") or "N/A",
                                "category": key.replace("_", " ").title(),
                                "evidence": [],
                                "session_title": title,
                                "session_id": sid,
                            }
                            # Collect evidence quotes
                            for ev_key in ("evidence", "evidence_quotes", "top_quotes"):
                                evs = item.get(ev_key, [])
                                if isinstance(evs, list):
                                    for ev in evs[:3]:
                                        if isinstance(ev, str):
                                            cluster["evidence"].append(ev)
                                        elif isinstance(ev, dict):
                                            cluster["evidence"].append(
                                                ev.get("text") or ev.get("quote") or str(ev)
                                            )
                            clusters.append(cluster)

                session_info["pattern_count"] = len(clusters)
                session_info["top_pains"] = pr.get("top_pains", [])
                session_info["segments"] = pr.get("segments_found", [])
                context["sessions"].append(session_info)
                context["patterns"].extend(clusters)

                # Extract spec info
                if spec and spec.get("decision"):
                    spec_entry = {
                        "session_id": sid,
                        "session_title": title,
                        "decision_what": spec.get("decision", {}).get("what", ""),
                        "decision_why": spec.get("decision", {}).get("why", ""),
                        "tasks_count": len(spec.get("task_breakdown", [])),
                        "success_criteria": spec.get("success_criteria", []),
                        "cursor_prompt_preview": (spec.get("cursor_prompt") or "")[:200],
                    }
                    context["specs"].append(spec_entry)

                # Extract decision/prioritization info
                if decision:
                    opportunities = decision.get("opportunities", [])
                    for opp in opportunities[:5]:
                        context["decisions"].append({
                            "session_id": sid,
                            "session_title": title,
                            "title": opp.get("title", ""),
                            "description": opp.get("description", ""),
                            "rice_score": opp.get("rice_score", "N/A"),
                            "rank": opp.get("rank", "N/A"),
                        })

                context["source_session_ids"].append(sid)

            # Sort sessions by relevance (keyword matches first, then recency)
            context["sessions"].sort(key=lambda s: (-s.get("relevance", 0), s.get("created_at", "")))

        context["specs_count"] = len(context["specs"])
        context["decisions_count"] = len(context["decisions"])

        # ── 2. Raw feedback items (keyword search) ────────────────
        if keywords:
            feedback = _search_feedback(db, project_id, keywords, limit=20)
            context["feedback_signals"] = feedback
            context["feedback_count"] = len(feedback)
        else:
            # Just get recent feedback count
            try:
                count_result = (
                    db.table("feedback_items")
                    .select("id", count="exact")
                    .eq("project_id", project_id)
                    .execute()
                )
                context["feedback_count"] = count_result.count or 0
            except Exception:
                pass

        # ── 3. Decision log (shipped/pending specs) ───────────────
        shipped_decisions = _query_decision_log(db, project_id)
        if shipped_decisions:
            for d in shipped_decisions:
                context["decisions"].append({
                    "session_title": "Decision Log",
                    "title": d.get("summary", ""),
                    "type": d.get("decision_type", ""),
                    "status": d.get("outcome_status", "pending"),
                    "reasoning": d.get("reasoning", ""),
                    "created_at": d.get("created_at", ""),
                })
            context["decisions_count"] = len(context["decisions"])

        # ── 4. Spec status tracking ───────────────────────────────
        specs_with_status = _query_specs(db, project_id)
        if specs_with_status:
            for sp in specs_with_status:
                context["specs"].append({
                    "session_title": sp.get("session_id", "")[:8],
                    "status": sp.get("status", "draft"),
                    "decision_what": (sp.get("decision") or {}).get("what", ""),
                    "decision_why": (sp.get("decision") or {}).get("why", ""),
                    "tasks_count": len((sp.get("task_breakdown") or [])),
                    "created_at": sp.get("created_at", ""),
                })
            context["specs_count"] = len(context["specs"])

        # ── 5. Business + repo context ────────────────────────────
        context["business_context"] = _load_business_context(db, project_id)
        context["repo_context"] = _load_repo_context(db, project_id)

    except Exception as exc:
        logger.error("ask_napkin.retrieval_failed", error=str(exc))

    return context


# ======================================================================
# DB Query Helpers
# ======================================================================

def _query_sessions(db, project_id: str, limit: int = 20) -> list[dict]:
    """Get recent completed sessions with their full data."""
    try:
        result = (
            db.table("sessions")
            .select("id, title, stage, status, pattern_report, spec_object, decision_object, task_plan, created_at, completed_at")
            .eq("project_id", project_id)
            .in_("stage", ["done", "error"])
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data or []
    except Exception as exc:
        logger.warning("ask_napkin.query_sessions_failed", error=str(exc))
        return []


def _search_feedback(db, project_id: str, keywords: list[str], limit: int = 20) -> list[dict]:
    """Search feedback items by keyword matching (raw_text ILIKE)."""
    try:
        # Supabase doesn't support ILIKE with OR easily, so search with the most
        # specific keyword and filter in Python
        query = (
            db.table("feedback_items")
            .select("id, raw_text, pain, request, emotion, segment_guess, created_at")
            .eq("project_id", project_id)
            .limit(100)
            .order("created_at", desc=True)
            .execute()
        )
        items = query.data or []

        # Score and filter by keyword relevance
        scored = []
        for item in items:
            text = (
                (item.get("raw_text") or "") + " " +
                (item.get("pain") or "") + " " +
                (item.get("request") or "")
            ).lower()
            score = sum(1 for kw in keywords if kw in text)
            if score > 0:
                item["relevance_score"] = score
                scored.append(item)

        scored.sort(key=lambda x: -x.get("relevance_score", 0))
        return scored[:limit]
    except Exception as exc:
        logger.warning("ask_napkin.search_feedback_failed", error=str(exc))
        return []


def _query_decision_log(db, project_id: str) -> list[dict]:
    """Get decision log entries for the project."""
    try:
        result = (
            db.table("decision_log")
            .select("id, decision_type, summary, reasoning, outcome_status, outcome_notes, created_at")
            .eq("project_id", project_id)
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        return result.data or []
    except Exception as exc:
        logger.warning("ask_napkin.query_decisions_failed", error=str(exc))
        return []


def _query_specs(db, project_id: str) -> list[dict]:
    """Get specs with their status for tracking what's shipped/pending."""
    try:
        result = (
            db.table("specs")
            .select("id, session_id, status, decision, task_breakdown, created_at, outcome")
            .eq("project_id", project_id)
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        return result.data or []
    except Exception as exc:
        logger.warning("ask_napkin.query_specs_failed", error=str(exc))
        return []


def _load_business_context(db, project_id: str) -> dict | None:
    """Load business context if available."""
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
    """Load repo context if available."""
    try:
        result = (
            db.table("repo_contexts")
            .select("stack, entities, routes, readme_content")
            .eq("project_id", project_id)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None
    except Exception:
        return None


# ======================================================================
# Context Formatting
# ======================================================================

def _format_context(context: dict) -> str:
    """Format retrieved context into a readable text block for the LLM."""
    parts = []

    # Sessions overview
    if context["sessions"]:
        parts.append(f"=== SESSIONS ({context['sessions_count']} total, showing top {min(len(context['sessions']), 10)}) ===")
        for s in context["sessions"][:10]:
            kw_note = f" [keyword match: {s['relevance']}]" if s.get("relevance", 0) > 0 else ""
            parts.append(
                f"\n📋 Session: {s['title']} | {s['created_at'][:10]} | Stage: {s['stage']}{kw_note}"
            )
            if s.get("top_pains"):
                pains = s["top_pains"][:5]
                parts.append(f"   Top pains: {', '.join(str(p) for p in pains)}")
            if s.get("segments"):
                parts.append(f"   Segments: {', '.join(str(seg) for seg in s['segments'][:5])}")
            parts.append(f"   Patterns found: {s.get('pattern_count', 0)}")

    # Patterns with evidence
    if context["patterns"]:
        parts.append(f"\n=== PATTERNS & CLUSTERS ({len(context['patterns'])} total) ===")
        for p in context["patterns"][:15]:  # Cap at 15 for token budget
            severity = p.get("severity", "N/A")
            parts.append(
                f"\n🔸 [{p['category']}] {p['label']}"
                f"\n   Severity: {severity} | Frequency: {p.get('frequency', 'N/A')} | Confidence: {p.get('confidence', 'N/A')}"
                f"\n   From session: {p.get('session_title', '?')}"
            )
            if p.get("description"):
                parts.append(f"   Description: {p['description'][:200]}")
            for quote in p.get("evidence", [])[:2]:
                parts.append(f'   Evidence: "{quote[:150]}"')

    # Specs
    if context["specs"]:
        parts.append(f"\n=== SPECS ({context['specs_count']} found) ===")
        for sp in context["specs"][:8]:
            status = sp.get("status", "draft")
            parts.append(
                f"\n📝 Spec: {sp.get('decision_what', 'Untitled')}"
                f"\n   Status: {status} | Tasks: {sp.get('tasks_count', 0)} | From: {sp.get('session_title', '?')}"
            )
            if sp.get("decision_why"):
                parts.append(f"   Why: {sp['decision_why'][:200]}")

    # Decisions / Opportunities
    if context["decisions"]:
        parts.append(f"\n=== DECISIONS & OPPORTUNITIES ({context['decisions_count']} found) ===")
        for d in context["decisions"][:10]:
            parts.append(
                f"\n🎯 {d.get('title', 'Decision')}"
                f"\n   Status: {d.get('status', 'N/A')} | RICE: {d.get('rice_score', 'N/A')}"
                f"\n   From: {d.get('session_title', '?')}"
            )
            if d.get("description"):
                parts.append(f"   Detail: {d['description'][:200]}")

    # Relevant feedback signals
    if context["feedback_signals"]:
        parts.append(f"\n=== MATCHING FEEDBACK ({len(context['feedback_signals'])} items matched keywords) ===")
        for fb in context["feedback_signals"][:10]:
            parts.append(f'\n💬 "{(fb.get("raw_text") or "")[:200]}"')
            if fb.get("pain"):
                parts.append(f"   Pain: {fb['pain']}")
            if fb.get("segment_guess"):
                parts.append(f"   Segment: {fb['segment_guess']}")

    # Business context
    biz = context.get("business_context")
    if biz:
        parts.append("\n=== BUSINESS CONTEXT ===")
        if biz.get("product_name"):
            parts.append(f"Product: {biz['product_name']}")
        if biz.get("core_value_prop"):
            parts.append(f"Value Prop: {biz['core_value_prop']}")
        if biz.get("target_customer"):
            parts.append(f"Target Customer: {biz['target_customer']}")

    if not parts:
        return "No data found in the workspace."

    return "\n".join(parts)


# ======================================================================
# Keyword Extraction
# ======================================================================

STOP_WORDS = frozenset({
    "what", "when", "where", "how", "why", "who", "which", "the", "a", "an",
    "is", "are", "was", "were", "did", "do", "does", "has", "have", "had",
    "i", "we", "our", "my", "me", "us", "show", "tell", "give", "find",
    "about", "from", "with", "that", "this", "all", "any", "been", "being",
    "can", "could", "would", "should", "will", "be", "to", "of", "in", "on",
    "for", "it", "its", "not", "but", "or", "and", "so", "if", "then",
    "than", "too", "very", "just", "also", "some", "most", "many", "much",
    "there", "their", "them", "they", "these", "those", "other",
    "get", "got", "getting", "make", "made", "let", "see", "seen",
    "last", "first", "like", "want", "need", "know", "think",
})


def _extract_keywords(question: str) -> list[str]:
    """Extract meaningful keywords from the user's question for search boosting."""
    words = re.findall(r'\b\w+\b', question.lower())
    keywords = [w for w in words if w not in STOP_WORDS and len(w) > 2]
    return keywords


# ======================================================================
# Message Persistence
# ======================================================================

def _save_message(
    db, project_id: str, user_id: str, session_id: str,
    role: str, content: str, metadata: dict | None = None,
) -> None:
    """Save a chat message to the database."""
    try:
        db.table("chat_messages").insert({
            "id": str(uuid4()),
            "project_id": project_id,
            "user_id": user_id,
            "session_id": session_id,
            "role": role,
            "content": content,
            "metadata": metadata or {},
            "created_at": datetime.now(UTC).isoformat(),
        }).execute()
    except Exception as exc:
        logger.error("ask_napkin.save_message_failed", role=role, error=str(exc))


def _load_chat_history(db, project_id: str, limit: int = 20) -> list[dict]:
    """Load last N chat messages for conversation continuity."""
    try:
        result = (
            db.table("chat_messages")
            .select("role, content, created_at")
            .eq("project_id", project_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        messages = result.data or []
        messages.reverse()
        return messages
    except Exception as exc:
        logger.warning("ask_napkin.load_history_failed", error=str(exc))
        return []
