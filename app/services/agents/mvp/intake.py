"""
Napkin — MVP Agent: Intake Structurer (ReAct)
Turns raw pasted/uploaded feedback into structured ExtractedSignal objects.
Uses a ReAct loop: LLM calls tools to extract, quality-check, and deduplicate signals.
"""

from __future__ import annotations

from uuid import uuid4

import numpy as np
import structlog
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool

from app.core.llm import get_embeddings, get_fast_llm
from app.models.llm_outputs import IntakeResult
from app.services.agents.prompts import INTAKE_STRUCTURER_SYSTEM, INTAKE_STRUCTURER_USER
from app.services.agents.react import react_loop

logger = structlog.get_logger(__name__)

# Maximum texts per extraction batch
BATCH_SIZE = 20


# ============================================================
# TOOLS — the LLM decides when and whether to call these
# ============================================================

@tool
async def extract_batch(texts: list[str]) -> dict:
    """Extract structured signals from a batch of feedback texts (max 20).

    Returns a dict with 'signals' list and 'count'.
    """
    if not texts:
        return {"signals": [], "count": 0}

    batch = texts[:BATCH_SIZE]
    feedback_text = "\n\n---\n\n".join(
        f"[Item {j + 1}]\n{text}" for j, text in enumerate(batch)
    )

    llm = get_fast_llm()
    structured_llm = llm.with_structured_output(IntakeResult)

    messages = [
        SystemMessage(content=INTAKE_STRUCTURER_SYSTEM),
        HumanMessage(content=INTAKE_STRUCTURER_USER.format(feedback_texts=feedback_text)),
    ]

    try:
        result = await structured_llm.ainvoke(messages)
        signals = _extract_signals_list(result)
    except Exception as exc:
        logger.warning("extract_batch.fallback", error=str(exc))
        # Fallback: treat each text as a low-confidence signal
        signals = [
            {
                "pain": text[:500],
                "request": "",
                "context": "",
                "emotion": "neutral",
                "jtbd_hint": "",
                "segment_guess": "",
                "raw_text_snippet": text[:200],
                "confidence": 0.3,
            }
            for text in batch
        ]

    return {"signals": signals, "count": len(signals)}


@tool
async def check_extraction_quality(signals: list[dict]) -> dict:
    """Check quality of extracted signals. Returns issues found.

    Checks for: low confidence scores, empty pain fields,
    suspicious emotion distribution (>80% neutral).
    """
    if not signals:
        return {
            "low_confidence_count": 0,
            "empty_pain_count": 0,
            "suspicious_patterns": [],
            "needs_reextraction": False,
        }

    low_conf = [s for s in signals if s.get("confidence", 0) < 0.5]
    empty_pain = [s for s in signals if not s.get("pain", "").strip()]
    neutral_count = sum(1 for s in signals if s.get("emotion") == "neutral")
    neutral_ratio = neutral_count / len(signals) if signals else 0

    patterns = []
    if neutral_ratio > 0.8:
        patterns.append(f"Suspicious: {neutral_ratio:.0%} of signals are 'neutral' emotion")
    if len(empty_pain) > len(signals) * 0.3:
        patterns.append(f"{len(empty_pain)} signals have empty pain fields")

    needs_retry = len(low_conf) > len(signals) * 0.3 or len(empty_pain) > len(signals) * 0.3

    return {
        "low_confidence_count": len(low_conf),
        "empty_pain_count": len(empty_pain),
        "suspicious_patterns": patterns,
        "needs_reextraction": needs_retry,
    }


@tool
async def deduplicate_signals(signals: list[dict], threshold: float = 0.92) -> dict:
    """Remove near-duplicate signals using embedding cosine similarity.

    Returns filtered signals list and count of duplicates removed.
    """
    if len(signals) < 2:
        return {"signals": signals, "duplicates_removed": 0}

    texts = [
        f"{s.get('pain', '')} {s.get('request', '')}" for s in signals
    ]

    try:
        embeddings_model = get_embeddings()
        embeddings = embeddings_model.embed_documents(texts)
        emb_matrix = np.array(embeddings)

        # Normalize for cosine similarity
        norms = np.linalg.norm(emb_matrix, axis=1, keepdims=True)
        norms = np.where(norms == 0, 1, norms)
        normalized = emb_matrix / norms

        # Pairwise cosine similarity
        sim_matrix = normalized @ normalized.T

        # Mark duplicates (keep first occurrence)
        keep = [True] * len(signals)
        for i in range(len(signals)):
            if not keep[i]:
                continue
            for j in range(i + 1, len(signals)):
                if keep[j] and sim_matrix[i][j] > threshold:
                    keep[j] = False

        filtered = [s for s, k in zip(signals, keep) if k]
        removed = len(signals) - len(filtered)

        return {"signals": filtered, "duplicates_removed": removed}
    except Exception as exc:
        logger.warning("deduplicate.fallback", error=str(exc))
        return {"signals": signals, "duplicates_removed": 0}


@tool
async def re_extract_batch(texts: list[str], critique: str) -> dict:
    """Re-extract signals from texts with self-critique context.

    Use this when check_extraction_quality found issues.
    The critique guides the LLM to fix specific problems.
    """
    if not texts:
        return {"signals": [], "count": 0}

    feedback_text = "\n\n---\n\n".join(
        f"[Item {j + 1}]\n{text}" for j, text in enumerate(texts[:BATCH_SIZE])
    )

    llm = get_fast_llm()
    structured_llm = llm.with_structured_output(IntakeResult)

    messages = [
        SystemMessage(content=INTAKE_STRUCTURER_SYSTEM),
        HumanMessage(content=(
            f"IMPORTANT — Previous extraction had issues: {critique}\n"
            f"Fix these issues in your extraction.\n\n"
            f"Raw feedback:\n{feedback_text}\n\n"
            "Output a JSON array of objects with fields: "
            "pain, request, context, emotion, jtbd_hint, segment_guess, raw_text_snippet"
        )),
    ]

    try:
        result = await structured_llm.ainvoke(messages)
        signals = _extract_signals_list(result)
    except Exception as exc:
        logger.warning("re_extract_batch.fallback", error=str(exc))
        signals = []

    return {"signals": signals, "count": len(signals)}


# ============================================================
# MAIN NODE — LangGraph entry point
# ============================================================

INTAKE_REACT_SYSTEM = """You are the Intake Structurer agent for Napkin.
Your job: turn raw customer feedback into structured signals.

You have these tools:
- extract_batch: Extract signals from a batch of up to 20 texts
- check_extraction_quality: Evaluate quality of extracted signals
- deduplicate_signals: Remove near-duplicate signals via embedding similarity
- re_extract_batch: Re-extract with critique if quality was low

WORKFLOW:
1. Call extract_batch for each batch of texts (up to 20 per call)
2. After all batches, call check_extraction_quality on all signals
3. If quality issues found, call re_extract_batch on problematic texts
4. Call deduplicate_signals to remove near-duplicates
5. When satisfied with quality, respond with your final summary (no more tool calls)

Your final message should summarize what you found (segments, signal count, etc.)."""


async def intake_structurer_node(state: dict) -> dict:
    """LangGraph node: Process raw feedback texts into structured signals via ReAct loop."""
    raw_texts = state.get("raw_texts", [])

    if not raw_texts:
        return {
            "feedback_items": state.get("feedback_items", []),
            "messages": state.get("messages", []) + [{
                "role": "assistant",
                "content": (
                    "No feedback provided yet. "
                    "Please paste or upload customer feedback to get started."
                ),
            }],
            "pending_questions": [
                "Please paste customer feedback, interview notes, or upload a file."
            ],
        }

    llm = get_fast_llm()

    # Prepare the texts description for the agent
    texts_summary = "\n".join(f"- Text {i+1}: {t[:100]}..." for i, t in enumerate(raw_texts[:5]))
    if len(raw_texts) > 5:
        texts_summary += f"\n... and {len(raw_texts) - 5} more texts"

    messages = [
        SystemMessage(content=INTAKE_REACT_SYSTEM),
        HumanMessage(content=(
            f"Process these {len(raw_texts)} feedback texts.\n\n"
            f"Preview:\n{texts_summary}\n\n"
            f"Full texts (pass to extract_batch in batches of 20):\n"
            f"{_format_texts_for_tool(raw_texts)}"
        )),
    ]

    tools = [extract_batch, check_extraction_quality, deduplicate_signals, re_extract_batch]

    try:
        await react_loop(llm, tools, messages, max_iterations=8)
    except Exception as exc:
        logger.error("intake.react_loop_error", error=str(exc))

    # Collect all signals from tool call results in the message history
    all_signals = _collect_signals_from_messages(messages)

    # If ReAct produced nothing, fallback to direct structured extraction
    if not all_signals:
        logger.warning("intake.react_empty_fallback")
        all_signals = await _fallback_extract(raw_texts, llm)

    # Assign UUIDs and merge with existing
    for signal in all_signals:
        if "feedback_item_id" not in signal:
            signal["feedback_item_id"] = str(uuid4())
        if "raw_text" not in signal:
            signal["raw_text"] = signal.get("raw_text_snippet", "")

    existing = state.get("feedback_items", [])
    all_items = existing + all_signals

    return {
        "feedback_items": all_items,
        "raw_texts": [],
        "messages": state.get("messages", []) + [{
            "role": "assistant",
            "content": (
                f"Processed {len(all_signals)} feedback signals. "
                f"Found segments: {_summarize_segments(all_signals)}. "
                f"Ready for pattern synthesis."
            ),
        }],
    }


# ============================================================
# HELPERS
# ============================================================

def _extract_signals_list(result) -> list[dict]:
    """Extract signals list from either a Pydantic model or dict."""
    if isinstance(result, dict):
        return result.get("signals", [])
    if hasattr(result, "signals"):
        return [s.model_dump() if hasattr(s, "model_dump") else s for s in result.signals]
    return []


def _format_texts_for_tool(texts: list[str]) -> str:
    """Format texts as a JSON-like list for the LLM to pass to extract_batch."""
    import json
    # Truncate very long texts
    truncated = [t[:2000] for t in texts]
    return json.dumps(truncated)


def _collect_signals_from_messages(messages: list) -> list[dict]:
    """Extract signals from ToolMessage results in the conversation history."""
    import json
    from langchain_core.messages import ToolMessage
    all_signals = []
    for msg in messages:
        if isinstance(msg, ToolMessage):
            try:
                data = json.loads(msg.content)
                if isinstance(data, dict) and "signals" in data:
                    all_signals.extend(data["signals"])
            except (json.JSONDecodeError, TypeError):
                pass
    return all_signals


async def _fallback_extract(raw_texts: list[str], llm) -> list[dict]:
    """Fallback: direct structured extraction without ReAct."""
    all_signals = []
    for i in range(0, len(raw_texts), BATCH_SIZE):
        batch = raw_texts[i:i + BATCH_SIZE]
        feedback_text = "\n\n---\n\n".join(
            f"[Item {j + 1}]\n{text}" for j, text in enumerate(batch)
        )
        try:
            structured_llm = llm.with_structured_output(IntakeResult)
            result = await structured_llm.ainvoke([
                SystemMessage(content=INTAKE_STRUCTURER_SYSTEM),
                HumanMessage(content=INTAKE_STRUCTURER_USER.format(feedback_texts=feedback_text)),
            ])
            all_signals.extend(_extract_signals_list(result))
        except Exception:
            for text in batch:
                all_signals.append({
                    "pain": text[:500],
                    "request": "",
                    "context": "",
                    "emotion": "neutral",
                    "jtbd_hint": "",
                    "segment_guess": "",
                    "raw_text_snippet": text[:200],
                    "confidence": 0.3,
                })
    return all_signals


def _summarize_segments(signals: list[dict]) -> str:
    """Quick summary of discovered segments."""
    segments = set()
    for s in signals:
        if s.get("segment_guess"):
            segments.add(s["segment_guess"])
    return ", ".join(segments) if segments else "not yet classified"
