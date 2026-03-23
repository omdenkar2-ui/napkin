"""
Napkin Backend — Stub Sub-Agents

Return realistic mock data so we can test the orchestrator flow end-to-end
without real LLM calls. Each stub matches the signature the real agent will
have when plugged in later.
"""

from __future__ import annotations

import logging
from uuid import uuid4

logger = logging.getLogger(__name__)

# The 4 strategic questions asked in order
_QUESTIONS = [
    "Who exactly is this for, and what job are they hiring this product to do?",
    "What's the smallest thing we can build in 2 weeks to prove this works?",
    "What are we explicitly NOT building? What's out of scope?",
    "What technical constraints, dependencies, or risks should the builder know?",
]


async def stub_intake_structurer(raw_texts: list[str]) -> list[dict]:
    """
    Mock intake: generate one ExtractedSignal dict per raw text.

    Returns plausible fake extractions with alternating segments/emotions
    so the evidence gate's diversity check can pass.
    """
    segments = ["power-user", "new-user", "enterprise-admin", "free-tier"]
    emotions = ["frustrated", "confused", "neutral", "hopeful"]
    sources = ["intercom chat", "user interview", "support ticket", "NPS survey"]

    signals: list[dict] = []
    for i, text in enumerate(raw_texts):
        signals.append({
            "id": str(uuid4()),
            "raw_text": text,
            "pain": f"Pain extracted from: {text[:80]}",
            "request": f"User wants: {text[:60]}",
            "context": "Product usage context",
            "emotion": emotions[i % len(emotions)],
            "jtbd_hint": "Get work done faster",
            "segment_guess": segments[i % len(segments)],
            "source_label": sources[i % len(sources)],
            "confidence": 0.85,
        })
    return signals


async def stub_signal_synthesis(signals: list[dict]) -> dict:
    """
    Mock synthesis: produce a PatternReport dict with 2-3 clusters
    derived from the input signals.
    """
    signal_ids = [s.get("id", str(uuid4())) for s in signals]

    clusters = [
        {
            "id": str(uuid4())[:8],
            "label": "Slow onboarding flow",
            "pain_summary": "Users struggle with initial setup — too many steps, unclear guidance.",
            "frequency": max(1, len(signals) // 2),
            "severity": 7.5,
            "confidence": 0.82,
            "urgency": "high",
            "evidence_quotes": [
                {
                    "text": signals[0].get("raw_text", "example quote")[:120],
                    "signal_id": signal_ids[0],
                    "author": "user-A",
                }
            ],
            "signal_ids": signal_ids[: len(signal_ids) // 2] or signal_ids[:1],
        },
        {
            "id": str(uuid4())[:8],
            "label": "Missing export feature",
            "pain_summary": "Users cannot export their data in a usable format.",
            "frequency": max(1, len(signals) // 3),
            "severity": 6.0,
            "confidence": 0.75,
            "urgency": "medium",
            "evidence_quotes": [
                {
                    "text": signals[-1].get("raw_text", "another quote")[:120],
                    "signal_id": signal_ids[-1],
                    "author": "user-B",
                }
            ],
            "signal_ids": signal_ids[len(signal_ids) // 2 :] or signal_ids[-1:],
        },
    ]

    segments = list({s.get("segment_guess") for s in signals if s.get("segment_guess")})

    return {
        "clusters": clusters,
        "top_pains": ["Slow onboarding flow", "Missing export feature"],
        "contradictions": [],
        "total_signals_analyzed": len(signals),
        "segments_found": segments or ["unknown"],
        "confidence_summary": "High confidence — clear clustering with strong evidence.",
    }


async def stub_socratic_questioner(
    pattern_report: dict,
    four_q_answers: dict | None,
    user_response: str | None,
) -> dict:
    """
    Mock Socratic questioner: process user answers and return the next question.

    If user_response is provided, slot it into the next unanswered field.
    Then return the next question (or mark complete if all 4 are answered).
    """
    answers = dict(four_q_answers or {})

    # If user responded, fill the next empty answer slot
    if user_response:
        if not answers.get("q1_segment_jtbd"):
            answers["q1_segment_jtbd"] = user_response
            answers["q1_evidence"] = ["Based on pattern analysis"]
        elif not answers.get("q2_smallest_proof"):
            answers["q2_smallest_proof"] = user_response
            answers["q2_scope_notes"] = "2-week scope"
        elif not answers.get("q3_non_goals"):
            answers["q3_non_goals"] = [user_response]
        elif not (answers.get("q4_constraints") or answers.get("q4_risks")):
            answers["q4_constraints"] = [user_response]
            answers["q4_risks"] = ["Timeline risk"]

    # Determine which question to ask next
    answered = 0
    if answers.get("q1_segment_jtbd"):
        answered += 1
    if answers.get("q2_smallest_proof"):
        answered += 1
    if answers.get("q3_non_goals"):
        answered += 1
    if answers.get("q4_constraints") or answers.get("q4_risks"):
        answered += 1

    if answered >= 4:
        return {"question": None, "updated_answers": answers}

    question = _QUESTIONS[answered]
    return {"question": question, "updated_answers": answers}


async def stub_spec_builder(
    pattern_report: dict,
    four_q_answers: dict,
) -> dict:
    """
    Mock spec builder: produce a complete SpecObject dict with all 6 sections
    and a clean cursor prompt.
    """
    top_pain = "Slow onboarding flow"
    if pattern_report.get("top_pains"):
        top_pain = pattern_report["top_pains"][0]

    segment = four_q_answers.get("q1_segment_jtbd", "power-user")

    return {
        "decision": {
            "what": f"Streamlined onboarding wizard targeting: {top_pain}",
            "why": "Most frequent and severe pain point across user segments",
            "evidence_refs": ["cluster-1-quote-1", "cluster-2-quote-1"],
            "segment": segment,
        },
        "ui_changes": [
            {
                "screen": "Onboarding",
                "component": "SetupWizard",
                "description": "3-step wizard replacing the current 8-field form",
            },
        ],
        "data_model": [
            {
                "entity": "onboarding_progress",
                "action": "create",
                "fields": ["user_id", "step", "completed_at"],
                "migration_notes": "New table, no breaking changes",
            },
        ],
        "task_breakdown": [
            {
                "title": "Create onboarding_progress table",
                "description": "Add migration for the new onboarding tracking table",
                "type": "DB",
                "estimate": "2h",
                "deps": [],
                "acceptance": ["Table exists with correct schema"],
            },
            {
                "title": "Build SetupWizard component",
                "description": "3-step React wizard with progress indicator",
                "type": "FE",
                "estimate": "6h",
                "deps": ["Create onboarding_progress table"],
                "acceptance": ["Wizard renders", "Steps navigate correctly"],
            },
            {
                "title": "Onboarding API endpoint",
                "description": "POST /api/onboarding/progress to track step completion",
                "type": "BE",
                "estimate": "3h",
                "deps": ["Create onboarding_progress table"],
                "acceptance": ["Endpoint returns 200", "Progress persisted"],
            },
        ],
        "success_criteria": [
            {
                "name": "Onboarding completion rate",
                "target": ">70%",
                "timeframe": "2 weeks post-launch",
            },
            {
                "name": "Time to first value",
                "target": "<5 minutes",
                "timeframe": "2 weeks post-launch",
            },
        ],
        "cursor_prompt": (
            "Build a 3-step onboarding wizard. "
            "Step 1: collect workspace name. "
            "Step 2: invite team members via email. "
            "Step 3: choose a starter template. "
            "Use React with TypeScript. "
            "Store progress in onboarding_progress table. "
            "Add POST /api/onboarding/progress endpoint. "
            "Non-goals: SSO integration, billing setup, admin dashboard."
        ),
    }
