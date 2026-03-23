"""
Napkin — MVP Agent: Signal Synthesis (ReAct)
Clusters feedback signals into themes, ranks pains, finds contradictions.
Uses a ReAct loop with embedding-based clustering for scale.
"""

from __future__ import annotations

import json

import numpy as np
import structlog
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool

from app.core.llm import get_embeddings, get_strong_llm
from app.models.llm_outputs import ClusterAnalysis, MergedSynthesis
from app.services.agents.prompts import SIGNAL_SYNTHESIS_SYSTEM
from app.services.agents.react import react_loop

logger = structlog.get_logger(__name__)

# Module-level state for tools to share embeddings/clusters
_tool_state: dict = {}


# ============================================================
# TOOLS — the LLM decides when and whether to call these
# ============================================================

@tool
async def embed_signals(signals: list[dict]) -> dict:
    """Embed all signals using sentence-transformer model.

    Returns shape info and stores embeddings for clustering.
    Must be called before cluster_signals.
    """
    texts = [
        f"{s.get('pain', '')} {s.get('request', '')} {s.get('context', '')}"
        for s in signals
    ]

    try:
        model = get_embeddings()
        embeddings = model.embed_documents(texts)
        emb_array = np.array(embeddings)
        _tool_state["embeddings"] = emb_array
        _tool_state["signals"] = signals
        return {
            "count": len(signals),
            "embedding_dim": emb_array.shape[1] if len(emb_array.shape) > 1 else 0,
            "status": "ready_for_clustering",
        }
    except Exception as exc:
        logger.warning("embed_signals.error", error=str(exc))
        _tool_state["signals"] = signals
        return {"count": len(signals), "status": "embedding_failed_use_llm_directly"}


@tool
async def cluster_signals(k: int) -> dict:
    """Run K-means clustering on embedded signals. Deterministic.

    Args:
        k: Number of clusters. Good rule: min(10, max(2, len(signals) // 5))

    Returns cluster assignments and sizes.
    """
    signals = _tool_state.get("signals", [])
    embeddings = _tool_state.get("embeddings")

    if embeddings is None or len(signals) < 2:
        # No embeddings — assign all to one cluster
        _tool_state["cluster_labels"] = [0] * len(signals)
        _tool_state["k"] = 1
        return {"clusters": 1, "sizes": [len(signals)], "note": "no embeddings, single cluster"}

    k = max(2, min(k, len(signals)))

    try:
        from sklearn.cluster import KMeans
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = km.fit_predict(embeddings)
        _tool_state["cluster_labels"] = labels.tolist()
        _tool_state["k"] = k

        sizes = [int(np.sum(labels == i)) for i in range(k)]
        return {"clusters": k, "sizes": sizes}
    except Exception as exc:
        logger.warning("cluster_signals.error", error=str(exc))
        _tool_state["cluster_labels"] = [i % k for i in range(len(signals))]
        _tool_state["k"] = k
        sizes = [len(signals) // k] * k
        return {"clusters": k, "sizes": sizes, "note": "fallback assignment"}


@tool
async def analyze_cluster(cluster_id: int) -> dict:
    """Analyze one cluster using LLM. Returns label, pain_summary, severity, evidence.

    Must be called after cluster_signals.
    """
    signals = _tool_state.get("signals", [])
    labels = _tool_state.get("cluster_labels", [])

    cluster_signals_list = [
        s for s, label in zip(signals, labels) if label == cluster_id
    ]

    if not cluster_signals_list:
        return {"label": f"Empty cluster {cluster_id}", "signals_count": 0}

    llm = get_strong_llm()
    structured_llm = llm.with_structured_output(ClusterAnalysis)

    signals_text = json.dumps(cluster_signals_list[:30], indent=1, default=str)

    try:
        result = await structured_llm.ainvoke([
            SystemMessage(content=(
                "Analyze this cluster of customer feedback signals. "
                "Produce a label, pain_summary, severity_score (0-10), confidence (0-1), "
                "and evidence_quotes (list of {text, signal_id})."
            )),
            HumanMessage(content=f"Cluster {cluster_id} ({len(cluster_signals_list)} signals):\n{signals_text}"),
        ])
        analysis = result.model_dump() if hasattr(result, "model_dump") else result
        analysis["signal_ids"] = [s.get("id", s.get("feedback_item_id", "")) for s in cluster_signals_list]
        analysis["frequency"] = len(cluster_signals_list)
        return analysis
    except Exception as exc:
        logger.warning("analyze_cluster.error", cluster=cluster_id, error=str(exc))
        return {
            "label": f"Cluster {cluster_id}",
            "pain_summary": cluster_signals_list[0].get("pain", "Unknown"),
            "severity_score": 5.0,
            "confidence": 0.5,
            "evidence_quotes": [{"text": cluster_signals_list[0].get("pain", ""), "signal_id": ""}],
            "signal_ids": [s.get("id", "") for s in cluster_signals_list],
            "frequency": len(cluster_signals_list),
        }


@tool
async def evaluate_cluster_quality(analyses: list[dict]) -> dict:
    """Check quality of cluster analyses. Deterministic.

    Returns issues: oversized clusters, similar labels, underevidence clusters.
    """
    total_signals = sum(a.get("frequency", 0) for a in analyses)
    total_signals = max(total_signals, 1)

    oversized = []
    underevidence = []
    labels = []

    for a in analyses:
        freq = a.get("frequency", 0)
        if freq > total_signals * 0.3:
            oversized.append(a.get("label", ""))
        if len(a.get("evidence_quotes", [])) < 2:
            underevidence.append(a.get("label", ""))
        labels.append(a.get("label", "").lower())

    # Check for similar labels
    similar_pairs = []
    for i in range(len(labels)):
        for j in range(i + 1, len(labels)):
            # Simple word overlap check
            words_i = set(labels[i].split())
            words_j = set(labels[j].split())
            if words_i and words_j:
                overlap = len(words_i & words_j) / min(len(words_i), len(words_j))
                if overlap > 0.5:
                    similar_pairs.append([analyses[i].get("label", ""), analyses[j].get("label", "")])

    needs_iteration = bool(oversized or similar_pairs)

    return {
        "oversized_clusters": oversized,
        "similar_cluster_pairs": similar_pairs,
        "underevidence_clusters": underevidence,
        "needs_iteration": needs_iteration,
    }


@tool
async def split_cluster(cluster_id: int) -> dict:
    """Split an oversized cluster into 2 sub-clusters. Deterministic.

    Re-runs K-means with k=2 on the cluster's embeddings.
    """
    signals = _tool_state.get("signals", [])
    labels = _tool_state.get("cluster_labels", [])
    embeddings = _tool_state.get("embeddings")

    indices = [i for i, l in enumerate(labels) if l == cluster_id]

    if len(indices) < 4 or embeddings is None:
        return {"status": "too_small_to_split", "cluster_id": cluster_id}

    try:
        from sklearn.cluster import KMeans
        sub_emb = embeddings[indices]
        km = KMeans(n_clusters=2, random_state=42, n_init=10)
        sub_labels = km.fit_predict(sub_emb)

        new_k = _tool_state.get("k", max(labels) + 1)
        new_label = new_k

        for idx, sub_l in zip(indices, sub_labels):
            if sub_l == 1:
                labels[idx] = new_label

        _tool_state["cluster_labels"] = labels
        _tool_state["k"] = new_label + 1

        sizes = [int(np.sum(np.array(sub_labels) == i)) for i in range(2)]
        return {"status": "split", "original": cluster_id, "new_cluster": new_label, "sizes": sizes}
    except Exception:
        return {"status": "split_failed", "cluster_id": cluster_id}


@tool
async def merge_clusters(cluster_ids: list[int]) -> dict:
    """Merge multiple clusters into one. Assigns all to the first cluster ID."""
    labels = _tool_state.get("cluster_labels", [])
    if not cluster_ids or len(cluster_ids) < 2:
        return {"status": "nothing_to_merge"}

    target = cluster_ids[0]
    for i in range(len(labels)):
        if labels[i] in cluster_ids:
            labels[i] = target

    _tool_state["cluster_labels"] = labels
    merged_count = sum(1 for l in labels if l == target)
    return {"status": "merged", "target_cluster": target, "total_signals": merged_count}


@tool
async def compile_report(analyses: list[dict]) -> dict:
    """Compile final PatternReport from cluster analyses via LLM."""
    llm = get_strong_llm()
    structured_llm = llm.with_structured_output(MergedSynthesis)

    try:
        result = await structured_llm.ainvoke([
            SystemMessage(content=(
                "Compile a final Pattern Report from these cluster analyses. "
                "Produce: clusters (list with id, label, pain_summary, frequency, severity, "
                "confidence, urgency, evidence_quotes, signal_ids), "
                "top_pains (ranked list of labels), contradictions, segments_found, confidence_summary."
            )),
            HumanMessage(content=f"Cluster analyses:\n{json.dumps(analyses, indent=1, default=str)}"),
        ])
        report = result.model_dump() if hasattr(result, "model_dump") else result
        return report
    except Exception as exc:
        logger.warning("compile_report.error", error=str(exc))
        # Build report directly from analyses
        return {
            "clusters": analyses,
            "top_pains": [a.get("label", "") for a in sorted(analyses, key=lambda x: x.get("severity_score", 0), reverse=True)],
            "contradictions": [],
            "segments_found": list({s.get("segment", "") for a in analyses for s in _tool_state.get("signals", []) if s.get("segment")}),
            "confidence_summary": "Compiled from cluster analyses.",
        }


# ============================================================
# MAIN NODE — LangGraph entry point
# ============================================================

SYNTHESIS_REACT_SYSTEM = """You are the Signal Synthesis agent for Napkin.
Your job: analyze extracted feedback signals and produce a decision-ready Pattern Report.

You have these tools:
- embed_signals: Embed all signals for clustering (call first)
- cluster_signals: Run K-means clustering (pick k = min(10, max(2, signal_count // 5)))
- analyze_cluster: Analyze one cluster via LLM (call for each cluster)
- evaluate_cluster_quality: Check for oversized/similar/underevidence clusters
- split_cluster: Split an oversized cluster into 2
- merge_clusters: Merge similar clusters into one
- compile_report: Compile final PatternReport from all analyses

WORKFLOW:
1. embed_signals with all signals
2. cluster_signals with appropriate k
3. analyze_cluster for each cluster ID (0 through k-1)
4. evaluate_cluster_quality on all analyses
5. If issues found: split/merge clusters, re-analyze affected ones
6. compile_report with all final analyses
7. When done, respond with summary (no more tool calls)"""


async def signal_synthesis_node(state: dict) -> dict:
    """LangGraph node: Analyze extracted signals → PatternReport via ReAct loop."""
    feedback_items = state.get("feedback_items", [])

    if len(feedback_items) < 2:
        return {
            "messages": state.get("messages", []) + [{
                "role": "assistant",
                "content": "Need at least 2 feedback items to find patterns. "
                           "Please add more feedback.",
            }],
            "pending_questions": ["Can you provide more customer feedback?"],
        }

    # Reset tool state
    _tool_state.clear()

    llm = get_strong_llm()

    signals_preview = json.dumps(feedback_items[:3], indent=1, default=str)
    messages = [
        SystemMessage(content=SYNTHESIS_REACT_SYSTEM),
        HumanMessage(content=(
            f"Analyze these {len(feedback_items)} feedback signals.\n\n"
            f"Preview (first 3):\n{signals_preview}\n\n"
            f"Full signals (pass to embed_signals):\n{json.dumps(feedback_items, default=str)}"
        )),
    ]

    tools = [
        embed_signals, cluster_signals, analyze_cluster,
        evaluate_cluster_quality, split_cluster, merge_clusters, compile_report,
    ]

    try:
        await react_loop(llm, tools, messages, max_iterations=15)
    except Exception as exc:
        logger.error("synthesis.react_loop_error", error=str(exc))

    # Collect the pattern report from tool results
    pattern_report = _extract_report_from_messages(messages)

    # Fallback: if ReAct produced no report, use direct structured extraction
    if not pattern_report or not pattern_report.get("clusters"):
        logger.warning("synthesis.react_empty_fallback")
        pattern_report = await _fallback_synthesis(feedback_items, llm)

    pattern_report.setdefault("clusters", [])
    pattern_report.setdefault("top_pains", [])
    pattern_report.setdefault("contradictions", [])
    pattern_report.setdefault("total_items_analyzed", len(feedback_items))
    pattern_report.setdefault("segments_found", [])
    pattern_report.setdefault("confidence_summary", "")

    # Build summary
    cluster_count = len(pattern_report["clusters"])
    top_pain = _get_top_pain(pattern_report)
    segments_str = ", ".join(str(s) for s in pattern_report.get("segments_found", ["unknown"]))
    contradiction_count = len(pattern_report.get("contradictions", []))

    summary = (
        f"Pattern analysis complete. Found {cluster_count} themes across "
        f"{len(feedback_items)} feedback items.\n\n"
        f"**Top pain:** {top_pain}\n"
        f"**Segments found:** {segments_str}\n"
        f"**Contradictions:** {contradiction_count} detected\n\n"
        f"Ready to move to the 4 strategic questions."
    )

    return {
        "pattern_report": pattern_report,
        "messages": state.get("messages", []) + [{
            "role": "assistant",
            "content": summary,
        }],
    }


# ============================================================
# HELPERS
# ============================================================

def _extract_report_from_messages(messages: list) -> dict:
    """Extract the compiled report from ToolMessage results."""
    from langchain_core.messages import ToolMessage
    for msg in reversed(messages):
        if isinstance(msg, ToolMessage):
            try:
                data = json.loads(msg.content)
                if isinstance(data, dict) and "clusters" in data:
                    return data
            except (json.JSONDecodeError, TypeError):
                pass
    return {}


async def _fallback_synthesis(feedback_items: list[dict], llm) -> dict:
    """Fallback: direct structured synthesis without ReAct."""
    from app.services.agents.prompts import SIGNAL_SYNTHESIS_USER

    signals_for_prompt = [
        {
            "id": item.get("feedback_item_id", ""),
            "pain": item.get("pain"),
            "request": item.get("request"),
            "context": item.get("context"),
            "emotion": item.get("emotion"),
            "segment": item.get("segment_guess"),
        }
        for item in feedback_items[:50]  # Cap for token safety
    ]

    try:
        structured_llm = llm.with_structured_output(MergedSynthesis)
        result = await structured_llm.ainvoke([
            SystemMessage(content=SIGNAL_SYNTHESIS_SYSTEM),
            HumanMessage(content=SIGNAL_SYNTHESIS_USER.format(
                item_count=len(signals_for_prompt),
                signals_json=json.dumps(signals_for_prompt, indent=2, default=str),
            )),
        ])
        return result.model_dump() if hasattr(result, "model_dump") else result
    except Exception:
        return {}


def _get_top_pain(report: dict) -> str:
    """Extract top pain label from pattern report."""
    top_pains = report.get("top_pains", [])
    if not top_pains:
        return "none identified"
    raw = top_pains[0]
    if isinstance(raw, dict):
        return raw.get("name", raw.get("label", str(raw)))
    return str(raw)
