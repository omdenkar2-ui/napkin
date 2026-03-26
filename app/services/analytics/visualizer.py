"""
Napkin Analytics — Data visualization and analysis.

Generates charts from session pipeline data using pandas, matplotlib, and sklearn.
Called during the export phase; every chart is isolated — one failure never
blocks the others. All charts are returned as base64-encoded PNG strings so they
can be embedded in the PDF export or served via the API.

Charts produced (when data is available):
  - emotion_distribution      : bar chart of customer emotion signals
  - confidence_histogram      : histogram of extraction confidence scores
  - signal_pca                : 2-D PCA scatter of the signal space
  - cluster_severity          : scatter of cluster severity vs. frequency
  - cluster_heatmap           : normalised heatmap across cluster metrics
  - rice_scores               : horizontal bar chart of opportunity RICE scores
  - task_type_distribution    : pie + bar of task types and effort hours
  - sprint_gantt              : Gantt chart across 10-day sprint
  - team_load                 : effort hours broken down by role
  - priority_breakdown        : P0/P1/P2 task count and hours (dual axis)
"""
from __future__ import annotations

import base64
import io
import logging
import warnings
from typing import Any

import matplotlib
matplotlib.use("Agg")  # non-interactive backend — must come before pyplot
import matplotlib.patches as mpatches
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.preprocessing import LabelEncoder, StandardScaler

warnings.filterwarnings("ignore", category=UserWarning)

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------ palette ---

_PALETTE = {
    "primary":   "#6366f1",
    "secondary": "#8b5cf6",
    "success":   "#10b981",
    "warning":   "#f59e0b",
    "danger":    "#ef4444",
    "neutral":   "#6b7280",
    "bg":        "#f8fafc",
    "grid":      "#e2e8f0",
    "text":      "#1e293b",
    "subtext":   "#475569",
}

_EMOTION_COLORS: dict[str, str] = {
    "frustrated":   "#ef4444",
    "angry":        "#dc2626",
    "confused":     "#f59e0b",
    "disappointed": "#f97316",
    "neutral":      "#6b7280",
    "hopeful":      "#3b82f6",
    "delighted":    "#10b981",
}

_PRIORITY_COLORS: dict[str, str] = {
    "P0": "#ef4444",
    "P1": "#f59e0b",
    "P2": "#10b981",
}

_TASK_TYPE_COLORS: dict[str, str] = {
    "FE":    "#6366f1",
    "BE":    "#8b5cf6",
    "DB":    "#3b82f6",
    "INFRA": "#10b981",
    "TEST":  "#f59e0b",
}


# --------------------------------------------------------------- helpers ------

def _fig_to_b64(fig: plt.Figure) -> str:
    """Serialize a matplotlib Figure to a base64 PNG string, then close it."""
    buf = io.BytesIO()
    fig.savefig(
        buf, format="png", dpi=150, bbox_inches="tight",
        facecolor=_PALETTE["bg"], edgecolor="none",
    )
    buf.seek(0)
    encoded = base64.b64encode(buf.read()).decode("utf-8")
    plt.close(fig)
    return encoded


def _style(
    ax: plt.Axes,
    title: str,
    xlabel: str = "",
    ylabel: str = "",
) -> None:
    """Apply a consistent, minimal style to an Axes object."""
    ax.set_facecolor(_PALETTE["bg"])
    ax.set_title(title, fontsize=13, fontweight="bold", pad=12, color=_PALETTE["text"])
    if xlabel:
        ax.set_xlabel(xlabel, fontsize=10, color=_PALETTE["subtext"])
    if ylabel:
        ax.set_ylabel(ylabel, fontsize=10, color=_PALETTE["subtext"])
    ax.tick_params(colors=_PALETTE["subtext"], labelsize=9)
    ax.spines[["top", "right"]].set_visible(False)
    ax.spines[["left", "bottom"]].set_color(_PALETTE["grid"])
    ax.yaxis.grid(True, color=_PALETTE["grid"], linewidth=0.8, zorder=0)
    ax.set_axisbelow(True)


def _safe_numeric(series: pd.Series, fill: float = 0.0) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").fillna(fill)


# ----------------------------------------------------- individual charts ------

def _chart_emotion_distribution(signals: list[dict]) -> str | None:
    if not signals:
        return None
    df = pd.DataFrame(signals)
    if "emotion" not in df.columns:
        return None

    counts = df["emotion"].fillna("neutral").value_counts()
    if counts.empty:
        return None

    colors = [_EMOTION_COLORS.get(e, _PALETTE["neutral"]) for e in counts.index]

    fig, ax = plt.subplots(figsize=(8, 4), facecolor=_PALETTE["bg"])
    bars = ax.bar(counts.index, counts.values, color=colors, width=0.6, zorder=3)
    _style(ax, "Customer Emotion Distribution", "Emotion", "Signal Count")

    for bar, val in zip(bars, counts.values):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 0.1,
            str(int(val)),
            ha="center", va="bottom", fontsize=9, color=_PALETTE["subtext"],
        )

    plt.tight_layout()
    return _fig_to_b64(fig)


def _chart_confidence_histogram(signals: list[dict]) -> str | None:
    if not signals:
        return None
    df = pd.DataFrame(signals)
    if "confidence" not in df.columns:
        return None

    conf = _safe_numeric(df["confidence"], fill=0.5).dropna()
    if conf.empty:
        return None

    fig, ax = plt.subplots(figsize=(7, 4), facecolor=_PALETTE["bg"])
    ax.hist(conf, bins=10, range=(0.0, 1.0),
            color=_PALETTE["primary"], edgecolor="white", zorder=3)
    _style(ax, "Signal Extraction Confidence", "Confidence Score", "Count")

    mean_val = float(conf.mean())
    ax.axvline(mean_val, color=_PALETTE["danger"], linestyle="--",
               linewidth=1.5, label=f"Mean: {mean_val:.2f}", zorder=4)
    ax.legend(fontsize=9)
    plt.tight_layout()
    return _fig_to_b64(fig)


def _chart_signal_pca(signals: list[dict]) -> str | None:
    """
    PCA scatter: reduces signal features (confidence, emotion, segment) to 2-D.
    Requires at least 4 signals and 2 numeric features.
    """
    if len(signals) < 4:
        return None

    df = pd.DataFrame(signals)
    feature_cols: list[str] = []

    if "confidence" in df.columns:
        df["confidence"] = _safe_numeric(df["confidence"], fill=0.5)
        feature_cols.append("confidence")

    if "emotion" in df.columns:
        le = LabelEncoder()
        df["emotion_enc"] = le.fit_transform(
            df["emotion"].fillna("neutral").astype(str)
        )
        feature_cols.append("emotion_enc")

    if "segment_guess" in df.columns:
        le2 = LabelEncoder()
        df["segment_enc"] = le2.fit_transform(
            df["segment_guess"].fillna("unknown").astype(str)
        )
        feature_cols.append("segment_enc")

    if len(feature_cols) < 2:
        return None

    X = df[feature_cols].values
    X_scaled = StandardScaler().fit_transform(X)

    try:
        coords = PCA(n_components=2, random_state=42).fit_transform(X_scaled)
        pca_obj = PCA(n_components=2, random_state=42).fit(X_scaled)
        var_ratio = pca_obj.explained_variance_ratio_
    except Exception:
        return None

    emotions = df.get("emotion", pd.Series(["neutral"] * len(df))).fillna("neutral")
    colors = [_EMOTION_COLORS.get(str(e), _PALETTE["neutral"]) for e in emotions]

    fig, ax = plt.subplots(figsize=(8, 5), facecolor=_PALETTE["bg"])
    ax.scatter(
        coords[:, 0], coords[:, 1],
        c=colors, s=60, alpha=0.8,
        edgecolors="white", linewidth=0.8, zorder=3,
    )
    _style(
        ax,
        "Signal Space — PCA (2-D)",
        xlabel=f"PC1 ({var_ratio[0]:.0%} variance)",
        ylabel=f"PC2 ({var_ratio[1]:.0%} variance)",
    )

    unique_emotions = emotions.unique()
    patches = [
        mpatches.Patch(color=_EMOTION_COLORS.get(e, _PALETTE["neutral"]), label=e)
        for e in unique_emotions
    ]
    ax.legend(handles=patches, fontsize=8, loc="best")
    plt.tight_layout()
    return _fig_to_b64(fig)


def _chart_cluster_severity_frequency(clusters: list[dict]) -> str | None:
    if not clusters:
        return None

    rows = [
        {
            "label":     c.get("label", "Unknown"),
            "frequency": len(c.get("signal_ids", [])) or c.get("frequency", 1),
            "severity":  c.get("severity_score", c.get("severity", 5.0)),
            "confidence": c.get("confidence", 0.5),
        }
        for c in clusters
    ]
    df = pd.DataFrame(rows)
    df["severity"]  = _safe_numeric(df["severity"],  fill=5.0)
    df["frequency"] = _safe_numeric(df["frequency"], fill=1.0)
    df["confidence"] = _safe_numeric(df["confidence"], fill=0.5)

    fig, ax = plt.subplots(figsize=(9, 5), facecolor=_PALETTE["bg"])
    scatter = ax.scatter(
        df["frequency"], df["severity"],
        s=df["confidence"] * 400,
        c=df["confidence"], cmap="RdYlGn",
        alpha=0.85, edgecolors="white", linewidth=1.5,
        zorder=3, vmin=0, vmax=1,
    )
    for _, row in df.iterrows():
        ax.annotate(
            str(row["label"])[:25],
            (row["frequency"], row["severity"]),
            textcoords="offset points", xytext=(6, 4),
            fontsize=8, color=_PALETTE["subtext"],
        )
    cbar = plt.colorbar(scatter, ax=ax)
    cbar.set_label("Confidence", fontsize=9, color=_PALETTE["subtext"])
    _style(ax, "Pain Clusters — Severity vs. Frequency",
           "Frequency (# signals)", "Severity (0–10)")
    plt.tight_layout()
    return _fig_to_b64(fig)


def _chart_cluster_heatmap(clusters: list[dict]) -> str | None:
    if len(clusters) < 2:
        return None

    rows = [
        {
            "Cluster":    str(c.get("label", "Unknown"))[:20],
            "Frequency":  float(len(c.get("signal_ids", [])) or c.get("frequency", 1)),
            "Severity":   float(c.get("severity_score", c.get("severity", 5.0))),
            "Confidence": float(c.get("confidence", 0.5)),
        }
        for c in clusters
    ]
    df = pd.DataFrame(rows).set_index("Cluster")
    raw = df.copy()

    try:
        normed = pd.DataFrame(
            StandardScaler().fit_transform(df),
            index=df.index, columns=df.columns,
        )
    except Exception:
        normed = df

    fig_h = max(3, len(clusters) * 0.6 + 1)
    fig, ax = plt.subplots(figsize=(8, fig_h), facecolor=_PALETTE["bg"])
    im = ax.imshow(normed.values, cmap="RdYlGn", aspect="auto", vmin=-2, vmax=2)

    ax.set_xticks(range(len(normed.columns)))
    ax.set_xticklabels(normed.columns, fontsize=9)
    ax.set_yticks(range(len(normed.index)))
    ax.set_yticklabels(normed.index, fontsize=8)

    for i in range(len(raw)):
        for j in range(len(raw.columns)):
            ax.text(j, i, f"{raw.iloc[i, j]:.1f}",
                    ha="center", va="center", fontsize=7.5, color=_PALETTE["text"])

    plt.colorbar(im, ax=ax, label="Normalised Score")
    ax.set_title("Pain Cluster Heatmap", fontsize=13, fontweight="bold",
                 pad=10, color=_PALETTE["text"])
    plt.tight_layout()
    return _fig_to_b64(fig)


def _chart_rice_scores(opportunities: list[dict]) -> str | None:
    if not opportunities:
        return None

    rows = [
        {
            "title":      str(o.get("title", f"Opportunity {i + 1}"))[:40],
            "rice_score": float(o.get("rice_score", 0)),
        }
        for i, o in enumerate(opportunities)
    ]
    df = pd.DataFrame(rows).sort_values("rice_score")

    fig_h = max(3, len(df) * 0.55 + 1)
    fig, ax = plt.subplots(figsize=(9, fig_h), facecolor=_PALETTE["bg"])

    gradient_colors = plt.cm.RdYlGn(np.linspace(0.25, 0.9, len(df)))
    bars = ax.barh(df["title"], df["rice_score"],
                   color=gradient_colors, height=0.6, zorder=3)

    max_score = df["rice_score"].max() or 1.0
    for bar, val in zip(bars, df["rice_score"]):
        ax.text(
            bar.get_width() + max_score * 0.01,
            bar.get_y() + bar.get_height() / 2,
            f"{val:.0f}",
            va="center", fontsize=9, color=_PALETTE["subtext"],
        )

    _style(ax, "Opportunity RICE Scores", "RICE Score", "")
    ax.tick_params(axis="y", labelsize=8)
    plt.tight_layout()
    return _fig_to_b64(fig)


def _chart_task_type_distribution(tasks: list[dict]) -> str | None:
    if not tasks:
        return None

    df = pd.DataFrame(tasks)
    if "type" not in df.columns:
        return None

    counts = df["type"].value_counts()
    colors = [_TASK_TYPE_COLORS.get(t, _PALETTE["neutral"]) for t in counts.index]

    has_hours = "estimate_hours" in df.columns
    hours = (
        df.groupby("type")["estimate_hours"]
          .apply(lambda s: _safe_numeric(s).sum())
          .reindex(counts.index)
        if has_hours else None
    )

    fig, axes = plt.subplots(1, 2, figsize=(10, 4), facecolor=_PALETTE["bg"])

    # Left: pie — task count
    wedges, texts, autotexts = axes[0].pie(
        counts.values, labels=counts.index,
        colors=colors, autopct="%1.0f%%",
        startangle=90, pctdistance=0.78,
    )
    for t in texts + autotexts:
        t.set_fontsize(9)
    axes[0].set_title("Task Count by Type", fontsize=12,
                       fontweight="bold", color=_PALETTE["text"])

    # Right: bar — hours
    if hours is not None:
        bar_colors = [_TASK_TYPE_COLORS.get(t, _PALETTE["neutral"]) for t in hours.index]
        axes[1].bar(hours.index, hours.values,
                    color=bar_colors, width=0.6, zorder=3)
        _style(axes[1], "Effort Hours by Type", "Task Type", "Hours")
        for i, (_, v) in enumerate(hours.items()):
            axes[1].text(i, float(v) + 0.2, f"{v:.0f}h",
                         ha="center", fontsize=9, color=_PALETTE["subtext"])
    else:
        axes[1].axis("off")

    plt.tight_layout()
    return _fig_to_b64(fig)


def _chart_sprint_gantt(tasks: list[dict]) -> str | None:
    if not tasks:
        return None

    df = pd.DataFrame(tasks)
    df["sprint_day"]     = _safe_numeric(df.get("sprint_day",     pd.Series(dtype=float)), fill=0.0)
    df["estimate_hours"] = _safe_numeric(df.get("estimate_hours", pd.Series(dtype=float)), fill=4.0)
    df = df[df["sprint_day"] > 0].sort_values("sprint_day")

    if df.empty:
        return None

    fig_h = max(4, len(df) * 0.45 + 1)
    fig, ax = plt.subplots(figsize=(12, fig_h), facecolor=_PALETTE["bg"])

    for i, (_, row) in enumerate(df.iterrows()):
        task_type = str(row.get("type", "BE"))
        color     = _TASK_TYPE_COLORS.get(task_type, _PALETTE["neutral"])
        duration  = max(float(row["estimate_hours"]) / 8.0, 0.5)
        start     = float(row["sprint_day"]) - 1.0

        ax.barh(i, duration, left=start, color=color,
                height=0.6, alpha=0.85, zorder=3)
        ax.text(
            start + duration + 0.05, i,
            str(row.get("title", ""))[:30],
            va="center", fontsize=7.5, color=_PALETTE["subtext"],
        )

    ax.set_yticks(range(len(df)))
    ax.set_yticklabels(
        [f"[{str(r.get('type','?'))}] {str(r.get('title',''))[:25]}"
         for _, r in df.iterrows()],
        fontsize=7.5,
    )
    ax.set_xticks(range(11))
    ax.set_xticklabels([f"Day {d}" for d in range(11)], fontsize=8)
    _style(ax, "Sprint Gantt Chart", "Sprint Day", "")

    legend_patches = [
        mpatches.Patch(color=c, label=t)
        for t, c in _TASK_TYPE_COLORS.items()
    ]
    ax.legend(handles=legend_patches, loc="lower right", fontsize=8)
    plt.tight_layout()
    return _fig_to_b64(fig)


def _chart_team_load(team_load: dict) -> str | None:
    if not team_load:
        return None

    df = (
        pd.Series(team_load, dtype=float)
          .reset_index()
          .rename(columns={"index": "role", 0: "hours"})
          .sort_values("hours", ascending=False)
    )

    fig, ax = plt.subplots(figsize=(7, 4), facecolor=_PALETTE["bg"])
    colors = plt.cm.Set2(np.linspace(0, 1, len(df)))
    bars = ax.bar(df["role"], df["hours"], color=colors, width=0.6, zorder=3)
    _style(ax, "Team Load Distribution", "Role", "Hours")

    for bar, val in zip(bars, df["hours"]):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            float(bar.get_height()) + 0.3,
            f"{val:.0f}h",
            ha="center", fontsize=9, color=_PALETTE["subtext"],
        )

    plt.tight_layout()
    return _fig_to_b64(fig)


def _chart_priority_breakdown(tasks: list[dict]) -> str | None:
    if not tasks:
        return None

    df = pd.DataFrame(tasks)
    if "priority" not in df.columns:
        return None

    priority_order = ["P0", "P1", "P2"]
    counts = (
        df["priority"].value_counts()
          .reindex(priority_order)
          .fillna(0)
    )
    has_hours = "estimate_hours" in df.columns
    hours = (
        df.groupby("priority")["estimate_hours"]
          .apply(lambda s: _safe_numeric(s).sum())
          .reindex(priority_order)
          .fillna(0)
        if has_hours else None
    )

    x      = np.arange(len(priority_order))
    width  = 0.35
    colors = [_PRIORITY_COLORS[p] for p in priority_order]

    fig, ax = plt.subplots(figsize=(7, 4), facecolor=_PALETTE["bg"])
    ax.bar(x - width / 2, counts.values, width,
           label="Task Count", color=colors, zorder=3, alpha=0.9)

    if hours is not None:
        ax2 = ax.twinx()
        ax2.bar(x + width / 2, hours.values, width,
                label="Hours", color=colors, zorder=3, alpha=0.5, hatch="//")
        ax2.set_ylabel("Hours", fontsize=10, color=_PALETTE["subtext"])
        ax2.tick_params(colors=_PALETTE["subtext"], labelsize=9)
        ax2.spines[["top"]].set_visible(False)
        ax2.legend(loc="upper right", fontsize=8)

    ax.set_xticks(x)
    ax.set_xticklabels(["P0  Critical", "P1  High", "P2  Normal"], fontsize=9)
    _style(ax, "Task Priority Breakdown", "", "Task Count")
    ax.legend(loc="upper left", fontsize=8)
    plt.tight_layout()
    return _fig_to_b64(fig)


# ------------------------------------------------------- summary stats --------

def _compute_stats(
    signals:       list[dict],
    clusters:      list[dict],
    opportunities: list[dict],
    tasks:         list[dict],
) -> dict[str, Any]:
    stats: dict[str, Any] = {}

    if signals:
        df = pd.DataFrame(signals)
        if "confidence" in df.columns:
            conf = _safe_numeric(df["confidence"], fill=0.5)
            stats["avg_signal_confidence"] = round(float(conf.mean()), 3)
            stats["low_confidence_signals"] = int((conf < 0.5).sum())
        if "emotion" in df.columns:
            stats["dominant_emotion"]  = df["emotion"].value_counts().idxmax()
            stats["emotion_breakdown"] = df["emotion"].value_counts().to_dict()
        stats["total_signals"] = len(signals)

    if clusters:
        df = pd.DataFrame([
            {
                "severity":   float(c.get("severity_score", c.get("severity", 5))),
                "confidence": float(c.get("confidence", 0.5)),
                "frequency":  len(c.get("signal_ids", [])),
            }
            for c in clusters
        ])
        top = max(clusters, key=lambda c: len(c.get("signal_ids", [])), default={})
        stats["top_cluster"]          = top.get("label", "")
        stats["avg_cluster_severity"] = round(float(df["severity"].mean()), 2)
        stats["cluster_count"]        = len(clusters)

    if opportunities:
        scores = [float(o.get("rice_score", 0)) for o in opportunities]
        top_opp = max(opportunities, key=lambda o: o.get("rice_score", 0), default={})
        stats["top_opportunity"] = top_opp.get("title", "")
        stats["max_rice_score"]  = round(max(scores), 1) if scores else 0

    if tasks:
        df = pd.DataFrame(tasks)
        if "estimate_hours" in df.columns:
            hrs = _safe_numeric(df["estimate_hours"], fill=0.0)
            stats["total_sprint_hours"] = round(float(hrs.sum()), 1)
            stats["avg_task_hours"]     = round(float(hrs.mean()), 1)
        if "priority" in df.columns:
            stats["critical_tasks"] = int((df["priority"] == "P0").sum())
        stats["total_tasks"] = len(tasks)

    return stats


# --------------------------------------------------------- public API ---------

class AnalyticsResult:
    """All charts and stats produced for a single session."""

    def __init__(self) -> None:
        self.charts: dict[str, str]  = {}   # chart_name → base64 PNG
        self.stats:  dict[str, Any]  = {}   # scalar / dict summaries
        self.errors: dict[str, str]  = {}   # chart_name → error message

    def to_dict(self) -> dict[str, Any]:
        return {
            "charts":      self.charts,
            "stats":       self.stats,
            "errors":      self.errors,
            "chart_count": len(self.charts),
        }


def generate_session_analytics(state: dict) -> AnalyticsResult:
    """
    Generate all analytics charts and summary statistics for a session.

    Parameters
    ----------
    state : dict
        The NapkinState dict (or any dict with the standard pipeline keys:
        ``signals``, ``pattern_report``, ``prioritization_result``,
        ``sprint_plan``).

    Returns
    -------
    AnalyticsResult
        Always succeeds.  Individual chart failures are recorded in
        ``result.errors`` and never raise.
    """
    result = AnalyticsResult()

    # --- extract data from state ---
    signals:       list[dict] = list(state.get("signals") or [])
    pattern_report: dict      = dict(state.get("pattern_report") or {})
    clusters:      list[dict] = list(pattern_report.get("clusters", []))
    prioritization: dict      = dict(state.get("prioritization_result") or {})
    opportunities: list[dict] = list(prioritization.get("opportunities", []))
    sprint_plan:    dict      = dict(state.get("sprint_plan") or {})
    tasks:         list[dict] = list(sprint_plan.get("tasks", []))
    team_load:      dict      = dict(sprint_plan.get("team_load", {}))

    chart_jobs: list[tuple[str, Any, tuple]] = [
        ("emotion_distribution",    _chart_emotion_distribution,        (signals,)),
        ("confidence_histogram",    _chart_confidence_histogram,        (signals,)),
        ("signal_pca",              _chart_signal_pca,                  (signals,)),
        ("cluster_severity",        _chart_cluster_severity_frequency,  (clusters,)),
        ("cluster_heatmap",         _chart_cluster_heatmap,             (clusters,)),
        ("rice_scores",             _chart_rice_scores,                 (opportunities,)),
        ("task_type_distribution",  _chart_task_type_distribution,      (tasks,)),
        ("sprint_gantt",            _chart_sprint_gantt,                (tasks,)),
        ("team_load",               _chart_team_load,                   (team_load,)),
        ("priority_breakdown",      _chart_priority_breakdown,          (tasks,)),
    ]

    for name, fn, args in chart_jobs:
        try:
            chart = fn(*args)
            if chart:
                result.charts[name] = chart
        except Exception as exc:
            logger.warning("analytics.chart_failed", extra={"chart": name, "error": str(exc)})
            result.errors[name] = str(exc)

    try:
        result.stats = _compute_stats(signals, clusters, opportunities, tasks)
    except Exception as exc:
        logger.warning("analytics.stats_failed", extra={"error": str(exc)})
        result.errors["stats"] = str(exc)

    logger.info(
        "analytics.complete",
        extra={"charts": len(result.charts), "errors": len(result.errors)},
    )
    return result
