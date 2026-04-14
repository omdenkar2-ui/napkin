"""
Napkin — Synthesis: Pattern Discovery & Categorization
Clusters feedback signals into Critical Issues, Valuable Insights, and Future Opportunities.
Parallel cluster analysis — no ReAct loops.

Adapts strategy to data volume:
  1-5 signals  → Direct LLM analysis (skip KMeans)
  6-15 signals → LLM-based clustering
  15+ signals  → KMeans clustering
"""

import asyncio
import json

import numpy as np
import structlog
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm import get_embeddings, get_strong_llm, cached_system
from app.models.llm_outputs import ClusterAnalysisV2, FeedbackAnalysis

logger = structlog.get_logger(__name__)


async def synthesize_patterns(signals: list[dict]) -> dict:
    """Analyze signals → Pattern Report. ALWAYS produces output, never returns empty."""

    # ONLY reject if literally zero signals
    if not signals:
        return _empty_report(signals)

    llm = get_strong_llm()
    total_signals = len(signals)

    # STRATEGY: Adapt clustering approach to data volume
    if total_signals <= 5:
        # SMALL DATA: Skip KMeans entirely — send all signals directly to LLM
        # LLM is better at finding patterns in small datasets than KMeans
        report = await _direct_llm_analysis(signals, llm)
    elif total_signals <= 15:
        # MEDIUM DATA: Use simple similarity grouping, not KMeans
        # KMeans needs ~15+ points to produce meaningful clusters
        cluster_groups = await _llm_cluster(signals, llm)
        analyses = await asyncio.gather(
            *[_analyze_cluster(cid, csignals, llm) for cid, csignals in cluster_groups.items()],
            return_exceptions=True,
        )
        valid_analyses = [r for r in analyses if not isinstance(r, Exception)]
        if not valid_analyses:
            report = await _direct_llm_analysis(signals, llm)
        else:
            report = await _categorize_and_compile(valid_analyses, signals, llm)
    else:
        # LARGE DATA: Use KMeans as before — it works well with 15+ data points
        embeddings = _embed_signals(signals)
        k = min(12, max(3, total_signals // 5))
        labels = _cluster(embeddings, k)

        cluster_groups: dict[int, list[dict]] = {}
        for i, signal in enumerate(signals):
            cluster_groups.setdefault(labels[i], []).append(signal)

        analyses = await asyncio.gather(
            *[_analyze_cluster(cid, csignals, llm) for cid, csignals in cluster_groups.items()],
            return_exceptions=True,
        )
        valid_analyses = [r for r in analyses if not isinstance(r, Exception)]
        if not valid_analyses:
            report = await _direct_llm_analysis(signals, llm)
        else:
            report = await _categorize_and_compile(valid_analyses, signals, llm)

    # ALWAYS add data quality metadata
    report["data_quality"] = _assess_data_quality(total_signals)
    report["total_items_analyzed"] = total_signals

    logger.info(
        "synthesis_complete",
        total_signals=total_signals,
        strategy="direct" if total_signals <= 5 else "llm_cluster" if total_signals <= 15 else "kmeans",
        critical=len(report.get("critical_issues", [])),
        insights=len(report.get("valuable_insights", [])),
        opportunities=len(report.get("future_opportunities", [])),
    )
    return report


# ============================================================
# Strategy: Direct LLM Analysis (1-5 signals)
# ============================================================

async def _direct_llm_analysis(signals: list[dict], llm) -> dict:
    """For small datasets (1-5 signals): skip clustering, ask LLM directly."""
    structured_llm = llm.with_structured_output(FeedbackAnalysis)

    signals_text = json.dumps(signals, indent=2, default=str)

    try:
        result = await structured_llm.ainvoke([
            cached_system("""You are a product strategist analyzing customer feedback.
Even with limited data, EVERY piece of feedback contains actionable signal.

You MUST produce output in ALL three categories:

1. **CRITICAL ISSUES** — Problems causing real user pain. Even a single report of data loss or broken workflow counts. If only 1-2 signals exist, the most urgent pain IS the critical issue.

2. **VALUABLE INSIGHTS** — What does this feedback reveal about how users think, what they expect, or where the product falls short? Every piece of feedback reveals something.

3. **FUTURE OPPORTUNITIES** — Based on what users are asking for, what could this product become? Connect their requests to real industry trends.

RULES:
- You MUST return at least 1 item in EACH category. No empty arrays.
- With sparse data, it's fine to have low confidence — say so in the description.
- Use direct quotes from the feedback as evidence.
- Be specific and actionable, not generic.
- If there's only 1 signal, break it into multiple angles: the pain itself is critical, the behavioral insight is valuable, and the implied future need is an opportunity."""),
            HumanMessage(content=f"""Analyze these {len(signals)} feedback signals and produce a complete analysis.

Feedback signals:
{signals_text}

Remember: EVERY category must have at least 1 item. Low confidence is fine — empty categories are not."""),
        ])
        report = result.model_dump() if hasattr(result, "model_dump") else result
    except Exception as exc:
        logger.warning("direct_analysis_failed", error=str(exc))
        # Absolute fallback: construct report from raw signals
        report = _fallback_report_from_signals(signals)

    # Ensure all keys exist
    report.setdefault("critical_issues", [])
    report.setdefault("valuable_insights", [])
    report.setdefault("future_opportunities", [])
    report.setdefault("segments_found", [])
    report.setdefault("contradictions", [])
    report.setdefault("clusters", [])
    report.setdefault("top_pains", [])

    # GUARANTEE: If LLM returned empty categories despite instructions, fill them
    if not report["critical_issues"]:
        report["critical_issues"] = [{
            "title": signals[0].get("pain", "User-reported issue"),
            "description": signals[0].get("pain", "") + " " + signals[0].get("request", ""),
            "severity": 6,
            "evidence": [signals[0].get("pain", signals[0].get("raw_text_snippet", ""))],
            "recommended_action": signals[0].get("request", "Investigate and address this feedback"),
            "frequency": 1,
        }]

    if not report["valuable_insights"]:
        report["valuable_insights"] = [{
            "title": "User behavior pattern",
            "description": f"Feedback suggests users are experiencing: {signals[0].get('pain', 'issues')}. "
                          f"The implied job-to-be-done: {signals[0].get('jtbd_hint', 'unknown')}",
            "insight_type": "behavior",
            "evidence": [signals[0].get("pain", "")],
            "confidence": 0.4,
        }]

    if not report["future_opportunities"]:
        report["future_opportunities"] = [{
            "title": "Opportunity based on user feedback",
            "description": f"Users are requesting: {signals[0].get('request', 'improvements')}. "
                          f"This aligns with broader trends in the space.",
            "evidence": [signals[0].get("request", signals[0].get("pain", ""))],
            "confidence": 0.3,
        }]

    # Build top_pains from critical issues
    if not report["top_pains"]:
        report["top_pains"] = [ci.get("title", "") for ci in report["critical_issues"]]

    # Build clusters from critical_issues so the frontend has displayable PatternCards.
    # For small datasets (1-5 signals) there are no KMeans/LLM clusters, but critical_issues
    # contain the same data the frontend needs.
    if not report["clusters"]:
        report["clusters"] = [
            {
                "cluster_id": i,
                "label": ci.get("title", "Issue"),
                "pain_summary": ci.get("description", ""),
                "severity_score": ci.get("severity", 5),
                "confidence": ci.get("confidence", 0.5),
                "evidence_quotes": ci.get("evidence", []),
                "affected_segments": ci.get("affected_segments", []),
                "recommended_action": ci.get("recommended_action", ""),
                "frequency": ci.get("frequency", 1),
                "signal_ids": [],
            }
            for i, ci in enumerate(report["critical_issues"])
        ]

    return report


# ============================================================
# Strategy: LLM Clustering (6-15 signals)
# ============================================================

async def _llm_cluster(signals: list[dict], llm) -> dict[int, list[dict]]:
    """For medium datasets (6-15 signals): use LLM to group instead of KMeans."""
    signals_summary = json.dumps(
        [{"id": i, "pain": s.get("pain", ""), "request": s.get("request", "")} for i, s in enumerate(signals)],
        indent=1, default=str,
    )

    try:
        response = await llm.ainvoke([
            cached_system("""Group these feedback signals into 3-5 thematic clusters.
Output ONLY valid JSON (no markdown, no backticks):
{"groups": [{"cluster_id": 0, "signal_indices": [0, 3, 5], "theme": "..."}, ...]}
Every signal index must appear in exactly one group. Use 0-based indices."""),
            HumanMessage(content=f"Signals to group:\n{signals_summary}"),
        ])

        content = response.content if hasattr(response, "content") else str(response)
        # Strip markdown fences if present
        content = content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1] if "\n" in content else content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        grouping = json.loads(content)
        cluster_groups: dict[int, list[dict]] = {}
        for group in grouping.get("groups", []):
            cid = group["cluster_id"]
            cluster_groups[cid] = [signals[i] for i in group["signal_indices"] if i < len(signals)]

        # Make sure no signals were dropped
        assigned: set[int] = set()
        for group in grouping.get("groups", []):
            assigned.update(group["signal_indices"])
        unassigned = [i for i in range(len(signals)) if i not in assigned]
        if unassigned:
            # Add unassigned to the largest cluster
            largest_cid = max(cluster_groups, key=lambda c: len(cluster_groups[c]))
            cluster_groups[largest_cid].extend([signals[i] for i in unassigned])

        return cluster_groups if cluster_groups else {0: signals}

    except Exception as exc:
        logger.warning("llm_clustering_failed", error=str(exc))
        # Fallback: all signals in one cluster
        return {0: signals}


# ============================================================
# Data quality & fallbacks
# ============================================================

def _assess_data_quality(signal_count: int) -> dict:
    """Produce data quality metadata — informational only, never blocks."""
    if signal_count >= 15:
        return {
            "confidence": "high",
            "signal_count": signal_count,
            "note": f"Strong analysis based on {signal_count} feedback signals.",
        }
    elif signal_count >= 5:
        return {
            "confidence": "medium",
            "signal_count": signal_count,
            "note": f"Moderate data — {signal_count} signals analyzed. Adding more feedback will strengthen pattern confidence.",
        }
    elif signal_count >= 2:
        return {
            "confidence": "low",
            "signal_count": signal_count,
            "note": f"Limited data — {signal_count} signals analyzed. Patterns shown are directional. Add more feedback for higher confidence.",
        }
    else:
        return {
            "confidence": "very_low",
            "signal_count": signal_count,
            "note": "Analysis based on a single signal. Results are exploratory — add more feedback to validate these patterns.",
        }


def _fallback_report_from_signals(signals: list[dict]) -> dict:
    """Absolute last-resort fallback: build a report directly from signals without LLM."""
    critical = []
    insights = []
    opportunities = []

    for i, s in enumerate(signals[:3]):
        pain = s.get("pain", "User issue reported")
        request = s.get("request", "")
        emotion = s.get("emotion", "neutral")

        if emotion in ("frustrated", "angry", "disappointed") or i == 0:
            critical.append({
                "title": pain[:80],
                "description": pain,
                "severity": 7 if emotion in ("frustrated", "angry") else 5,
                "evidence": [s.get("raw_text_snippet", pain)],
                "recommended_action": request or "Investigate this user pain point",
                "frequency": 1,
            })
        else:
            insights.append({
                "title": pain[:80],
                "description": pain,
                "insight_type": "gap",
                "evidence": [s.get("raw_text_snippet", pain)],
                "confidence": 0.4,
            })

        if request:
            opportunities.append({
                "title": f"Opportunity: {request[:60]}",
                "description": request,
                "evidence": [s.get("raw_text_snippet", request)],
                "confidence": 0.3,
            })

    # Ensure at least 1 in each category
    if not critical:
        critical = [{"title": signals[0].get("pain", "Reported issue"), "description": signals[0].get("pain", ""), "severity": 5, "evidence": [], "recommended_action": "Review", "frequency": 1}]
    if not insights:
        insights = [{"title": "User behavior signal", "description": signals[0].get("jtbd_hint", "Needs investigation"), "insight_type": "behavior", "evidence": [], "confidence": 0.3}]
    if not opportunities:
        opportunities = [{"title": "Potential improvement area", "description": signals[0].get("request", "Based on user feedback"), "evidence": [], "confidence": 0.3}]

    return {
        "critical_issues": critical[:3],
        "valuable_insights": insights[:5],
        "future_opportunities": opportunities[:3],
        "clusters": [],
        "top_pains": [c["title"] for c in critical],
        "contradictions": [],
        "segments_found": list(set(s.get("segment_guess", "") for s in signals if s.get("segment_guess"))),
    }


# ============================================================
# Shared helpers (used by all strategies)
# ============================================================

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
            cached_system(
                "Analyze this cluster of customer feedback signals. "
                "Produce: label (3-6 word name), pain_summary (2-3 sentences), "
                "severity_score (0-10, where 10=data loss/can't use product), "
                "confidence (0-1), evidence_quotes (2-3 direct quotes), "
                "affected_segments (user types), recommended_action (specific fix)."
            ),
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
            cached_system("""You are a product strategist analyzing clustered customer feedback.

Categorize each cluster into ONE of three categories:

1. **CRITICAL ISSUES** — Urgent problems causing user pain, frustration, or churn. High severity (7+), high frequency. Needs immediate fix. Include specific recommended actions.

2. **VALUABLE INSIGHTS** — Interesting patterns revealing user behavior, preferences, or product gaps. Not necessarily urgent but strategically important. Classify as: behavior, preference, gap, or trend.

3. **FUTURE OPPORTUNITIES** — Forward-looking ideas informed by the feedback AND your knowledge of current market/technology trends (AI adoption, API-first architectures, mobile-first shifts, privacy regulations, etc.). Connect what users are asking for to where the industry is heading. Be specific about the world context.

CRITICAL REQUIREMENT:
You MUST return at least 1 item in EACH of the three categories (critical_issues, valuable_insights, future_opportunities).
An empty category means the analysis failed. With even a single cluster, there is always a critical issue (the pain),
an insight (what it reveals), and an opportunity (what could be built). Low confidence is acceptable. Empty arrays are not.

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
    """Only returned when there are literally zero signals to analyze."""
    return {
        "critical_issues": [],
        "valuable_insights": [],
        "future_opportunities": [],
        "clusters": [],
        "top_pains": [],
        "contradictions": [],
        "segments_found": [],
        "total_items_analyzed": 0,
        "data_quality": {
            "confidence": "none",
            "signal_count": 0,
            "note": "No feedback signals provided. Paste or upload user feedback to get started.",
        },
    }
