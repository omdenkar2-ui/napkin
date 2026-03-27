"""
Napkin — Synthesis: Pattern Discovery & Categorization
Clusters feedback signals into Critical Issues, Valuable Insights, and Future Opportunities.
Parallel cluster analysis — no ReAct loops.
"""

import asyncio
import json

import numpy as np
import structlog
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm import get_embeddings, get_strong_llm
from app.models.llm_outputs import ClusterAnalysisV2, FeedbackAnalysis

logger = structlog.get_logger(__name__)


async def synthesize_patterns(signals: list[dict]) -> dict:
    """Analyze signals → Pattern Report with critical/insight/opportunity categories."""
    if len(signals) < 2:
        return _empty_report(signals)

    # Step 1: Embed all signals in one batch
    embeddings = _embed_signals(signals)

    # Step 2: KMeans cluster
    k = min(12, max(2, len(signals) // 4))
    labels = _cluster(embeddings, k)

    # Step 3: Group signals by cluster
    cluster_groups: dict[int, list[dict]] = {}
    for i, signal in enumerate(signals):
        label = labels[i]
        cluster_groups.setdefault(label, []).append(signal)

    # Step 4: Analyze ALL clusters in parallel
    llm = get_strong_llm()
    analyses = await asyncio.gather(
        *[_analyze_cluster(cid, csignals, llm) for cid, csignals in cluster_groups.items()],
        return_exceptions=True,
    )

    valid_analyses = []
    for i, result in enumerate(analyses):
        if isinstance(result, Exception):
            logger.warning("cluster_analysis_failed", cluster=i, error=str(result))
        else:
            valid_analyses.append(result)

    if not valid_analyses:
        return _empty_report(signals)

    # Step 5: Categorize into critical/insights/opportunities (single LLM call)
    report = await _categorize_and_compile(valid_analyses, signals, llm)

    logger.info(
        "synthesis_complete",
        clusters=len(valid_analyses),
        critical=len(report.get("critical_issues", [])),
        insights=len(report.get("valuable_insights", [])),
        opportunities=len(report.get("future_opportunities", [])),
    )
    return report


def _embed_signals(signals: list[dict]) -> np.ndarray:
    """Embed all signals in one batch call."""
    texts = [
        f"{s.get('pain', '')} {s.get('request', '')} {s.get('context', '')}"
        for s in signals
    ]
    try:
        model = get_embeddings()
        return np.array(model.embed_documents(texts))
    except Exception as e:
        logger.warning("embedding_failed_using_random", error=str(e))
        return np.random.randn(len(signals), 384)


def _cluster(embeddings: np.ndarray, k: int) -> list[int]:
    """KMeans clustering."""
    try:
        from sklearn.cluster import KMeans
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        return km.fit_predict(embeddings).tolist()
    except Exception as e:
        logger.warning("clustering_failed", error=str(e))
        return [i % k for i in range(len(embeddings))]


async def _analyze_cluster(cluster_id: int, signals: list[dict], llm) -> dict:
    """Analyze one cluster via LLM structured output."""
    signals_text = json.dumps(signals[:30], indent=1, default=str)

    structured_llm = llm.with_structured_output(ClusterAnalysisV2)

    try:
        result = await structured_llm.ainvoke([
            SystemMessage(content=(
                "Analyze this cluster of customer feedback signals. "
                "Produce: label (3-6 word name), pain_summary (2-3 sentences), "
                "severity_score (0-10, where 10=data loss/can't use product), "
                "confidence (0-1), evidence_quotes (2-3 direct quotes), "
                "affected_segments (user types), recommended_action (specific fix)."
            )),
            HumanMessage(content=f"Cluster {cluster_id} ({len(signals)} signals):\n{signals_text}"),
        ])
        analysis = result.model_dump() if hasattr(result, "model_dump") else result
    except Exception as exc:
        logger.warning("analyze_cluster.fallback", cluster=cluster_id, error=str(exc))
        analysis = {
            "label": f"Cluster {cluster_id}",
            "pain_summary": signals[0].get("pain", "Unknown issue"),
            "severity_score": 5.0,
            "confidence": 0.5,
            "evidence_quotes": [signals[0].get("pain", "")],
            "affected_segments": [],
            "recommended_action": "Review feedback manually",
        }

    analysis["cluster_id"] = cluster_id
    analysis["frequency"] = len(signals)
    analysis["signal_ids"] = [s.get("feedback_item_id", "") for s in signals]
    return analysis


async def _categorize_and_compile(analyses: list[dict], signals: list[dict], llm) -> dict:
    """Categorize clusters into critical issues, insights, and future opportunities."""
    structured_llm = llm.with_structured_output(FeedbackAnalysis)

    try:
        result = await structured_llm.ainvoke([
            SystemMessage(content="""You are a product strategist analyzing clustered customer feedback.

Categorize each cluster into ONE of three categories:

1. **CRITICAL ISSUES** — Urgent problems causing user pain, frustration, or churn. High severity (7+), high frequency. Needs immediate fix. Include specific recommended actions.

2. **VALUABLE INSIGHTS** — Interesting patterns revealing user behavior, preferences, or product gaps. Not necessarily urgent but strategically important. Classify as: behavior, preference, gap, or trend.

3. **FUTURE OPPORTUNITIES** — Forward-looking ideas informed by the feedback AND your knowledge of current market/technology trends (AI adoption, API-first architectures, mobile-first shifts, privacy regulations, etc.). Connect what users are asking for to where the industry is heading. Be specific about the world context.

Rules:
- Every item must have evidence (direct quotes from feedback)
- Be specific and actionable — no generic advice
- Future opportunities MUST reference real industry trends, not vague platitudes
- Identify contradictions where different segments want opposite things"""),
            HumanMessage(content=(
                f"Cluster analyses ({len(analyses)} clusters from {len(signals)} feedback items):\n\n"
                f"{json.dumps(analyses, indent=2, default=str)}\n\n"
                "Categorize each cluster and compile the final analysis."
            )),
        ])
        report = result.model_dump() if hasattr(result, "model_dump") else result
    except Exception as exc:
        logger.warning("categorization_failed", error=str(exc))
        report = {
            "critical_issues": [],
            "valuable_insights": [
                {"title": a.get("label", ""), "description": a.get("pain_summary", ""),
                 "evidence": a.get("evidence_quotes", []), "confidence": a.get("confidence", 0.5)}
                for a in analyses
            ],
            "future_opportunities": [],
        }

    report.setdefault("critical_issues", [])
    report.setdefault("valuable_insights", [])
    report.setdefault("future_opportunities", [])
    report.setdefault("segments_found", [])
    report.setdefault("contradictions", [])

    # Add metadata for downstream consumers
    report["clusters"] = analyses
    report["total_items_analyzed"] = len(signals)
    report["top_pains"] = [
        a.get("label", "")
        for a in sorted(analyses, key=lambda x: x.get("severity_score", 0), reverse=True)
    ]

    return report


def _empty_report(signals: list[dict]) -> dict:
    return {
        "critical_issues": [],
        "valuable_insights": [],
        "future_opportunities": [],
        "clusters": [],
        "top_pains": [],
        "contradictions": [],
        "segments_found": [],
        "total_items_analyzed": len(signals),
    }
