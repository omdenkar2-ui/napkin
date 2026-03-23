"""
Napkin — MVP Agent: Socratic Questioner (ReAct)
Adaptive strategic questioner that uses coverage-gap analysis to decide
what to ask, whether to follow up, and when to stop.
"""

from __future__ import annotations

import json

import structlog
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool

from app.core.llm import get_strong_llm
from app.models.llm_outputs import AnswerExtraction, QuestionDecision
from app.services.agents.prompts import SOCRATIC_QUESTIONER_SYSTEM
from app.services.agents.react import react_loop

logger = structlog.get_logger(__name__)

# Strategic topics (coverage areas, not a rigid queue)
STRATEGIC_TOPICS = {
    "segment_jtbd": {
        "key": "q1_segment_jtbd",
        "label": "Segment + JTBD",
        "default_question": "Who exactly is this for, and what job are they hiring this product to do?",
        "fields": ["q1_segment_jtbd", "q1_evidence"],
    },
    "smallest_proof": {
        "key": "q2_smallest_proof",
        "label": "Smallest Proof",
        "default_question": "What's the smallest thing we can build in 2 weeks to prove this works?",
        "fields": ["q2_smallest_proof", "q2_scope_notes"],
    },
    "non_goals": {
        "key": "q3_non_goals",
        "label": "Non-Goals",
        "default_question": "What are we explicitly NOT building? What's out of scope?",
        "fields": ["q3_non_goals"],
    },
    "constraints": {
        "key": "q4_constraints",
        "label": "Constraints & Risks",
        "default_question": "What technical constraints, dependencies, or risks should the builder know?",
        "fields": ["q4_constraints", "q4_risks", "q4_dependencies"],
    },
}


# ============================================================
# TOOLS — the LLM decides when to call these
# ============================================================

@tool
async def check_coverage_gaps(answers: dict) -> dict:
    """Check which strategic topics still need answers. Deterministic.

    Returns list of uncovered topics with context about what's missing.
    """
    gaps = []
    covered = []

    for topic_id, topic in STRATEGIC_TOPICS.items():
        has_answer = False
        for field in topic["fields"]:
            val = answers.get(field)
            if val and (not isinstance(val, list) or len(val) > 0):
                has_answer = True
                break

        if has_answer:
            covered.append(topic_id)
        else:
            gaps.append({
                "topic": topic_id,
                "label": topic["label"],
                "default_question": topic["default_question"],
            })

    return {
        "covered": covered,
        "gaps": gaps,
        "all_covered": len(gaps) == 0,
        "coverage_pct": len(covered) / len(STRATEGIC_TOPICS),
    }


@tool
async def evaluate_answer_quality(topic: str, answer: str) -> dict:
    """Evaluate whether an answer is actionable or too vague. Deterministic.

    Flags answers like 'all users', 'make it better', answers < 20 chars.
    """
    vague_phrases = [
        "all users", "everyone", "make it better", "improve", "optimize",
        "all of them", "everything", "i don't know", "not sure",
    ]

    answer_lower = answer.lower().strip()
    is_vague = False
    issues = []

    if len(answer_lower) < 20:
        is_vague = True
        issues.append("Answer is very short (< 20 chars)")

    for phrase in vague_phrases:
        if phrase in answer_lower:
            is_vague = True
            issues.append(f"Contains vague phrase: '{phrase}'")

    quality = 0.3 if is_vague else 0.8

    return {
        "topic": topic,
        "quality_score": quality,
        "is_vague": is_vague,
        "issues": issues,
    }


@tool
async def extract_implicit_answers(pattern_report: dict, answers: dict) -> dict:
    """Check if pattern_report data already answers some strategic topics. Deterministic.

    e.g., if clusters clearly show one dominant segment, Q1 might be partially answered.
    If a user's Q2 answer specifies scope, Q3 non-goals might be implicit.
    """
    implicit = {}

    clusters = pattern_report.get("clusters", [])
    segments = pattern_report.get("segments_found", [])

    # Check if segments are clear enough to partially answer Q1
    if segments and len(segments) <= 2 and not answers.get("q1_segment_jtbd"):
        implicit["segment_jtbd"] = {
            "partial": True,
            "data": f"Pattern data suggests segments: {', '.join(str(s) for s in segments)}",
        }

    # Check if Q2 scope notes imply non-goals
    scope = answers.get("q2_scope_notes", "")
    proof = answers.get("q2_smallest_proof", "")
    if (scope or proof) and not answers.get("q3_non_goals"):
        scope_text = f"{proof} {scope}".lower()
        if "only" in scope_text or "just" in scope_text or "single" in scope_text:
            implicit["non_goals"] = {
                "partial": True,
                "data": f"Q2 answer implies scope limits: '{proof}'",
            }

    return {
        "implicit_answers": implicit,
        "topics_partially_covered": list(implicit.keys()),
    }


@tool
async def synthesize_answer(topic: str, user_response: str) -> dict:
    """Extract structured data from a user's response for a specific topic.

    Uses LLM to parse the conversational answer into structured fields.
    """
    topic_info = STRATEGIC_TOPICS.get(topic, {})
    label = topic_info.get("label", topic)

    llm = get_strong_llm()
    structured_llm = llm.with_structured_output(AnswerExtraction)

    try:
        result = await structured_llm.ainvoke([
            SystemMessage(content=(
                "Extract structured data from the user's answer to a strategic question. "
                "Output: extracted_data (dict with relevant fields), quality_score (0-1), "
                "is_vague (bool), followup_needed (str, empty if not needed)."
            )),
            HumanMessage(content=(
                f"Topic: {label}\n"
                f"Question: {topic_info.get('default_question', '')}\n"
                f"User's answer: \"{user_response}\"\n\n"
                f"Extract the structured answer."
            )),
        ])

        if isinstance(result, dict):
            return result
        if hasattr(result, "model_dump"):
            return result.model_dump()
        return {"extracted_data": {}, "quality_score": 0.5, "is_vague": False, "followup_needed": ""}
    except Exception as exc:
        logger.warning("synthesize_answer.error", topic=topic, error=str(exc))
        return {
            "extracted_data": {"raw": user_response},
            "quality_score": 0.5,
            "is_vague": False,
            "followup_needed": "",
        }


# ============================================================
# MAIN NODE — LangGraph entry point
# ============================================================

SOCRATIC_REACT_SYSTEM = """You are the Socratic Questioner agent for Napkin.
Your job: guide the user through strategic questions that prevent "building the wrong thing."

You have these tools:
- check_coverage_gaps: See which topics still need answers
- evaluate_answer_quality: Check if an answer is vague or actionable
- extract_implicit_answers: Check if pattern data already covers some topics
- synthesize_answer: Extract structured data from a user's response

4 Strategic Topics:
1. segment_jtbd: Who is this for? What job are they hiring this product to do?
2. smallest_proof: What's the smallest 2-week proof?
3. non_goals: What are we NOT building?
4. constraints: What constraints, dependencies, risks?

WORKFLOW when user responds:
1. Call synthesize_answer with the appropriate topic and user response
2. Call evaluate_answer_quality to check if the answer is actionable
3. If vague: ask a targeted follow-up (action: "followup")
4. If good: call check_coverage_gaps to see what's next
5. Optionally call extract_implicit_answers to skip questions already covered
6. Decide: ask next question (action: "ask"), follow up (action: "followup"), or complete (action: "complete")

WORKFLOW when no user response (first call):
1. Call check_coverage_gaps
2. Call extract_implicit_answers
3. Ask the most important uncovered topic

Be direct. No fluff. Push back on vague answers."""


async def socratic_questioner_node(state: dict) -> dict:
    """LangGraph node: Ask the next strategic question or process an answer via ReAct."""
    pattern_report = state.get("pattern_report", {})
    four_q_answers = state.get("four_q_answers") or {}
    user_response = state.get("user_response")
    messages_state = state.get("messages", [])

    llm = get_strong_llm()

    # Determine current state for the agent
    answered = _get_answered_questions(four_q_answers)
    current_q_index = len(answered)

    # If user just responded, process their answer
    if user_response and current_q_index < 4:
        current_topic = _get_current_topic(current_q_index)
        four_q_answers = await _process_answer_react(
            llm, current_topic, user_response, four_q_answers, pattern_report
        )

        answered = _get_answered_questions(four_q_answers)
        current_q_index = len(answered)

    # Check if all questions are answered
    if current_q_index >= 4:
        four_q_answers["is_complete"] = True
        return {
            "four_q_answers": four_q_answers,
            "user_response": None,
            "pending_questions": [],
            "messages": messages_state + [{
                "role": "assistant",
                "content": "All 4 strategic questions answered. Building your spec now.",
            }],
        }

    # Ask the next question using ReAct to decide which topic
    question_text = await _ask_next_question_react(
        llm, four_q_answers, pattern_report, user_response, current_q_index
    )

    next_topic_info = _get_topic_info(current_q_index)

    return {
        "four_q_answers": four_q_answers,
        "user_response": None,
        "pending_questions": [question_text],
        "messages": messages_state + [{
            "role": "assistant",
            "content": question_text,
            "metadata": {
                "question_number": current_q_index + 1,
                "question_key": next_topic_info["key"],
                "question_label": next_topic_info["label"],
            },
        }],
    }


# ============================================================
# INTERNAL REACT FLOWS
# ============================================================

async def _process_answer_react(
    llm, topic_id: str, user_response: str, answers: dict, pattern_report: dict
) -> dict:
    """Process a user answer via ReAct tools."""
    tools = [synthesize_answer, evaluate_answer_quality]

    react_messages = [
        SystemMessage(content=SOCRATIC_REACT_SYSTEM),
        HumanMessage(content=(
            f"The user answered topic '{topic_id}'.\n"
            f"Their response: \"{user_response}\"\n"
            f"Process this answer using synthesize_answer, then evaluate_answer_quality."
        )),
    ]

    try:
        await react_loop(llm, tools, react_messages, max_iterations=3)
    except Exception as exc:
        logger.warning("socratic.process_answer_error", error=str(exc))

    # Extract the synthesized answer from tool results
    extraction = _extract_synthesis_from_messages(react_messages)

    # Map extracted data to the right answer fields
    _store_answer(answers, topic_id, extraction, user_response)

    return answers


async def _ask_next_question_react(
    llm, answers: dict, pattern_report: dict, user_response: str | None, q_index: int
) -> str:
    """Use ReAct to decide and formulate the next question."""
    tools = [check_coverage_gaps, extract_implicit_answers, evaluate_answer_quality]

    raw_pains = pattern_report.get("top_pains", [])[:3]
    top_pains_str = ", ".join(
        p.get("name", str(p)) if isinstance(p, dict) else str(p) for p in raw_pains
    ) if raw_pains else "not yet analyzed"

    react_messages = [
        SystemMessage(content=SOCRATIC_REACT_SYSTEM),
        HumanMessage(content=(
            f"Pattern report top pains: {top_pains_str}\n"
            f"Answers so far: {json.dumps(answers, default=str)}\n"
            f"Previous user response: {user_response or 'N/A'}\n\n"
            f"Decide what to ask next. Use check_coverage_gaps and extract_implicit_answers, "
            f"then formulate a targeted question."
        )),
    ]

    try:
        response = await react_loop(llm, tools, react_messages, max_iterations=3)
        if response and hasattr(response, "content") and response.content:
            return response.content
    except Exception as exc:
        logger.warning("socratic.ask_question_error", error=str(exc))

    # Fallback: ask the default question for the current index
    topic_info = _get_topic_info(q_index)
    return f"**Q{q_index + 1} — {topic_info['label']}**\n\n{topic_info['default_question']}"


# ============================================================
# HELPERS
# ============================================================

def _get_current_topic(q_index: int) -> str:
    """Get the topic ID for the current question index."""
    topics = list(STRATEGIC_TOPICS.keys())
    return topics[q_index] if q_index < len(topics) else topics[-1]


def _get_topic_info(q_index: int) -> dict:
    """Get topic metadata for a question index."""
    topics = list(STRATEGIC_TOPICS.values())
    return topics[q_index] if q_index < len(topics) else topics[-1]


def _extract_synthesis_from_messages(messages: list) -> dict:
    """Extract the synthesize_answer result from tool messages."""
    from langchain_core.messages import ToolMessage
    for msg in reversed(messages):
        if isinstance(msg, ToolMessage):
            try:
                data = json.loads(msg.content)
                if isinstance(data, dict) and "extracted_data" in data:
                    return data
            except (json.JSONDecodeError, TypeError):
                pass
    return {}


def _store_answer(answers: dict, topic_id: str, extraction: dict, raw_response: str) -> None:
    """Store extracted or raw answer in the answers dict."""
    extracted = extraction.get("extracted_data", {})

    if topic_id == "segment_jtbd":
        answers["q1_segment_jtbd"] = extracted.get("segment_jtbd", raw_response)
        answers["q1_evidence"] = extracted.get("evidence", [])
    elif topic_id == "smallest_proof":
        answers["q2_smallest_proof"] = extracted.get("smallest_proof", raw_response)
        answers["q2_scope_notes"] = extracted.get("scope_notes", "")
    elif topic_id == "non_goals":
        answers["q3_non_goals"] = extracted.get("non_goals", [raw_response])
    elif topic_id == "constraints":
        answers["q4_constraints"] = extracted.get("constraints", [])
        answers["q4_risks"] = extracted.get("risks", [])
        answers["q4_dependencies"] = extracted.get("dependencies", [])
        # Fallback: if no structured data, store raw
        if not answers["q4_constraints"] and not answers["q4_risks"]:
            answers["q4_constraints"] = [raw_response]


def _get_answered_questions(answers: dict) -> list[str]:
    """Return list of answered question summaries."""
    answered = []
    if answers.get("q1_segment_jtbd"):
        answered.append("Q1: " + str(answers["q1_segment_jtbd"])[:100])
    if answers.get("q2_smallest_proof"):
        answered.append("Q2: " + str(answers["q2_smallest_proof"])[:100])
    if answers.get("q3_non_goals"):
        answered.append("Q3: " + str(answers["q3_non_goals"])[:100])
    if answers.get("q4_constraints") or answers.get("q4_risks"):
        answered.append("Q4: constraints/risks provided")
    return answered
