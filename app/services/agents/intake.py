"""
Napkin — Intake: Parallel Feedback Extraction
Turns raw feedback texts into structured signals using parallel batched LLM calls.
No ReAct loops — direct, deterministic pipeline.
"""

import asyncio
from uuid import uuid4

import numpy as np
import structlog
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm import get_embeddings, get_fast_llm
from app.models.llm_outputs import IntakeResult
from app.services.agents.prompts import INTAKE_STRUCTURER_SYSTEM, INTAKE_STRUCTURER_USER

logger = structlog.get_logger(__name__)

BATCH_SIZE = 50
MAX_CONCURRENT = 5


async def extract_signals(raw_texts: list[str]) -> list[dict]:
    """Extract structured signals from raw feedback. Parallel batched."""
    if not raw_texts:
        return []

    batches = [raw_texts[i:i + BATCH_SIZE] for i in range(0, len(raw_texts), BATCH_SIZE)]

    semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    async def process_batch(batch: list[str]) -> list[dict]:
        async with semaphore:
            return await _extract_batch(batch)

    results = await asyncio.gather(
        *[process_batch(b) for b in batches],
        return_exceptions=True,
    )

    all_signals = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.error("extract_batch_failed", batch=i, error=str(result))
            for text in batches[i]:
                all_signals.append(_raw_fallback(text))
        else:
            all_signals.extend(result)

    if len(all_signals) > 1:
        all_signals = _deduplicate(all_signals)

    for signal in all_signals:
        if "feedback_item_id" not in signal:
            signal["feedback_item_id"] = str(uuid4())
        if "raw_text" not in signal:
            signal["raw_text"] = signal.get("raw_text_snippet", "")

    logger.info("intake_complete", signals=len(all_signals), inputs=len(raw_texts))
    return all_signals


async def _extract_batch(texts: list[str]) -> list[dict]:
    """Extract signals from one batch via structured LLM output."""
    feedback_text = "\n\n---\n\n".join(
        f"[Item {j + 1}]\n{text[:2000]}" for j, text in enumerate(texts)
    )

    llm = get_fast_llm()
    structured_llm = llm.with_structured_output(IntakeResult)

    try:
        result = await structured_llm.ainvoke([
            SystemMessage(content=INTAKE_STRUCTURER_SYSTEM),
            HumanMessage(content=INTAKE_STRUCTURER_USER.format(feedback_texts=feedback_text)),
        ])
        return _extract_signals_list(result)
    except Exception as exc:
        logger.warning("extract_batch.fallback", error=str(exc))
        return [_raw_fallback(t) for t in texts]


def _deduplicate(signals: list[dict], threshold: float = 0.92) -> list[dict]:
    """Remove near-duplicate signals using embedding cosine similarity."""
    texts = [f"{s.get('pain', '')} {s.get('request', '')}" for s in signals]

    try:
        model = get_embeddings()
        embeddings = model.embed_documents(texts)
        emb = np.array(embeddings)

        norms = np.linalg.norm(emb, axis=1, keepdims=True)
        norms = np.where(norms == 0, 1, norms)
        normalized = emb / norms

        sim = normalized @ normalized.T

        keep = [True] * len(signals)
        for i in range(len(signals)):
            if not keep[i]:
                continue
            for j in range(i + 1, len(signals)):
                if keep[j] and sim[i][j] > threshold:
                    keep[j] = False

        filtered = [s for s, k in zip(signals, keep) if k]
        removed = len(signals) - len(filtered)
        if removed:
            logger.info("dedup_removed", count=removed)
        return filtered
    except Exception as e:
        logger.warning("dedup_failed", error=str(e))
        return signals


def _extract_signals_list(result) -> list[dict]:
    if isinstance(result, dict):
        return result.get("signals", [])
    if hasattr(result, "signals"):
        return [s.model_dump() if hasattr(s, "model_dump") else s for s in result.signals]
    return []


def _raw_fallback(text: str) -> dict:
    return {
        "pain": text[:500],
        "request": "",
        "context": "",
        "emotion": "neutral",
        "jtbd_hint": "",
        "segment_guess": "",
        "raw_text_snippet": text[:200],
        "confidence": 0.3,
    }
