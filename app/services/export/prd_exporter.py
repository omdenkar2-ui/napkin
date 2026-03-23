"""
Napkin — PRD PDF Exporter

Generates a styled Product Requirements Document as PDF bytes
using ReportLab Platypus. No file I/O — returns bytes directly.
"""
from __future__ import annotations

from datetime import UTC, datetime
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# Brand colours
TEAL = colors.HexColor("#1B4D4A")
LIGHT_GREY = colors.HexColor("#F5F5F5")
DARK_GREY = colors.HexColor("#666666")
WHITE = colors.white
BLACK = colors.black

PAGE_W, PAGE_H = A4
MARGIN = 2 * cm


# ============================================================
# Page numbering — "Page N of M"
# ============================================================

class _NumberedCanvas:
    """Mixin-free page-number helper used via onFirstPage / onLaterPages."""

    def __init__(self):
        self._pages: list[int] = []

    def __call__(self, canvas, doc):
        self._pages.append(canvas.getPageNumber())
        canvas.saveState()
        canvas.setFont("Helvetica", 9)
        canvas.setFillColor(DARK_GREY)
        # We don't know total pages during build, so use a deferred approach
        canvas.drawCentredString(
            PAGE_W / 2, 1.2 * cm,
            f"Page {canvas.getPageNumber()}",
        )
        canvas.restoreState()


def _add_page_number(canvas, doc):
    """Simple page number callback for SimpleDocTemplate."""
    canvas.saveState()
    canvas.setFont("Helvetica", 9)
    canvas.setFillColor(DARK_GREY)
    canvas.drawCentredString(
        PAGE_W / 2, 1.2 * cm,
        f"Page {canvas.getPageNumber()}",
    )
    canvas.restoreState()


# ============================================================
# Styles
# ============================================================

def _build_styles() -> dict[str, ParagraphStyle]:
    """Build custom paragraph styles."""
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "PRDTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=22,
            textColor=TEAL,
            spaceAfter=6,
        ),
        "subtitle": ParagraphStyle(
            "PRDSubtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=12,
            textColor=DARK_GREY,
            spaceAfter=4,
        ),
        "confidential": ParagraphStyle(
            "PRDConfidential",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            textColor=DARK_GREY,
            spaceAfter=8,
        ),
        "heading": ParagraphStyle(
            "PRDHeading",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            textColor=TEAL,
            spaceBefore=18,
            spaceAfter=10,
        ),
        "subheading": ParagraphStyle(
            "PRDSubheading",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12,
            textColor=BLACK,
            spaceBefore=10,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "PRDBody",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=BLACK,
            spaceAfter=6,
            leading=14,
        ),
        "body_italic": ParagraphStyle(
            "PRDBodyItalic",
            parent=base["Normal"],
            fontName="Helvetica-Oblique",
            fontSize=10,
            textColor=DARK_GREY,
            spaceAfter=6,
            leading=14,
        ),
        "bullet": ParagraphStyle(
            "PRDBullet",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=BLACK,
            leftIndent=20,
            spaceAfter=3,
            leading=13,
            bulletIndent=10,
        ),
        "stat_label": ParagraphStyle(
            "PRDStatLabel",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9,
            textColor=DARK_GREY,
            alignment=TA_CENTER,
        ),
        "stat_value": ParagraphStyle(
            "PRDStatValue",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=18,
            textColor=TEAL,
            alignment=TA_CENTER,
            spaceAfter=2,
        ),
    }


# ============================================================
# Table styling helpers
# ============================================================

_HEADER_STYLE = [
    ("BACKGROUND", (0, 0), (-1, 0), TEAL),
    ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, 0), 9),
    ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
    ("FONTSIZE", (0, 1), (-1, -1), 9),
    ("ALIGN", (0, 0), (-1, -1), "LEFT"),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CCCCCC")),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
]


def _alternate_row_colours(row_count: int) -> list[tuple]:
    """Return TableStyle commands for alternating row shading."""
    cmds = []
    for i in range(1, row_count):
        if i % 2 == 0:
            cmds.append(("BACKGROUND", (0, i), (-1, i), LIGHT_GREY))
    return cmds


def _safe(text: str, max_len: int = 0) -> str:
    """Escape XML entities for Paragraph and optionally truncate."""
    text = str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    if max_len and len(text) > max_len:
        text = text[: max_len - 3] + "..."
    return text


# ============================================================
# Section builders
# ============================================================

def _add_header(elements: list, state: dict, styles: dict) -> None:
    """Section 1 — Document Header."""
    session_name = state.get("session_name") or state.get("session_id", "Untitled Session")
    date_str = datetime.now(UTC).strftime("%B %d, %Y")

    elements.append(Paragraph("Product Requirements Document", styles["title"]))
    elements.append(Paragraph(_safe(str(session_name)), styles["subtitle"]))
    elements.append(Paragraph(f"Generated: {date_str}", styles["subtitle"]))
    elements.append(
        Paragraph("Confidential — Generated by Napkin", styles["confidential"])
    )
    elements.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceAfter=12))


def _add_executive_summary(elements: list, state: dict, styles: dict) -> None:
    """Section 2 — Executive Summary (2x2 stat table)."""
    elements.append(Paragraph("Executive Summary", styles["heading"]))

    feedback_count = len(state.get("feedback_items", []))
    dedup = state.get("dedup_report", {})
    dupes_removed = dedup.get("duplicates_removed", "N/A")
    pattern_count = len(state.get("pattern_cards", []))
    feature_count = len(state.get("prioritized_features", []))

    def _stat_cell(value, label):
        return [
            Paragraph(str(value), styles["stat_value"]),
            Paragraph(label, styles["stat_label"]),
        ]

    data = [
        [_stat_cell(feedback_count, "Total Feedback Items"),
         _stat_cell(dupes_removed, "Duplicates Removed")],
        [_stat_cell(pattern_count, "Patterns Identified"),
         _stat_cell(feature_count, "Features Prioritized")],
    ]

    avail_w = PAGE_W - 2 * MARGIN
    col_w = avail_w / 2

    table = Table(data, colWidths=[col_w, col_w])
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CCCCCC")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CCCCCC")),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 12))


def _add_patterns(elements: list, state: dict, styles: dict) -> None:
    """Section 3 — Feedback Patterns table."""
    elements.append(Paragraph("Feedback Patterns", styles["heading"]))

    pattern_cards = state.get("pattern_cards", [])
    if not pattern_cards:
        elements.append(Paragraph("No patterns identified.", styles["body"]))
        return

    sorted_cards = sorted(pattern_cards, key=lambda p: p.get("confidence", 0), reverse=True)

    avail_w = PAGE_W - 2 * MARGIN
    col_widths = [avail_w * 0.25, avail_w * 0.12, avail_w * 0.13, avail_w * 0.50]

    header = ["Pattern", "Confidence", "Feedback Items", "Description"]
    rows = [header]

    for card in sorted_cards:
        conf = card.get("confidence", 0)
        conf_str = f"{int(conf * 100)}%" if isinstance(conf, float) else str(conf)
        source_count = str(len(card.get("source_item_ids", [])))
        desc = _safe(card.get("description", ""), max_len=120)
        rows.append([
            _safe(card.get("name", "Unknown")),
            conf_str,
            source_count,
            Paragraph(desc, styles["body"]),
        ])

    table = Table(rows, colWidths=col_widths, repeatRows=1)
    style_cmds = list(_HEADER_STYLE) + _alternate_row_colours(len(rows))
    table.setStyle(TableStyle(style_cmds))
    elements.append(table)
    elements.append(Spacer(1, 12))


def _add_features(elements: list, state: dict, styles: dict) -> None:
    """Section 4 — Prioritized Features (top 10)."""
    elements.append(Paragraph("Prioritized Features", styles["heading"]))

    features = state.get("prioritized_features", [])
    if not features:
        elements.append(Paragraph("No features prioritized.", styles["body"]))
        return

    spec = state.get("spec", {})
    spec_sections = {
        s.get("feature_id", s.get("title", "")): s
        for s in spec.get("features", [])
    }
    pattern_cards = {
        p.get("pattern_id"): p
        for p in state.get("pattern_cards", [])
    }

    for feat in features[:10]:
        pid = feat.get("pattern_id", "")
        pattern = pattern_cards.get(pid, {})
        spec_section = spec_sections.get(pid, {})

        name = pattern.get("name", spec_section.get("title", f"Feature {pid}"))
        rice = feat.get("rice_score", 0)
        from app.services.export.tickets_exporter import _rice_to_priority, _effort_to_tshirt
        priority = _rice_to_priority(rice)
        effort = _effort_to_tshirt(feat.get("effort_weeks", feat.get("effort", 1)))

        elements.append(Paragraph(_safe(name), styles["subheading"]))
        elements.append(Paragraph(
            f"RICE Score: {rice} | Priority: {priority} | Effort: {effort}",
            styles["body"],
        ))

        desc = spec_section.get("description", "")
        if desc:
            elements.append(Paragraph(_safe(desc), styles["body_italic"]))

        linked = pattern.get("name", pid)
        if linked:
            elements.append(Paragraph(f"Driven by: {_safe(str(linked))}", styles["body"]))

        acceptance = spec_section.get("acceptance_criteria", [])
        for ac in acceptance:
            elements.append(Paragraph(f"\u2022 {_safe(str(ac))}", styles["bullet"]))

        elements.append(Spacer(1, 6))


def _add_spec(elements: list, state: dict, styles: dict) -> None:
    """Section 5 — Technical Spec Summary."""
    elements.append(Paragraph("Technical Specification", styles["heading"]))

    spec = state.get("spec", {})
    spec_features = spec.get("features", [])
    if not spec_features:
        elements.append(Paragraph("No technical specification available.", styles["body"]))
        return

    for section in spec_features:
        title = section.get("title", "Untitled")
        elements.append(Paragraph(_safe(title), styles["subheading"]))

        desc = section.get("description", "")
        if desc:
            elements.append(Paragraph(_safe(desc), styles["body"]))

        tasks = section.get("task_breakdown", section.get("tasks", []))
        for task in tasks:
            task_text = task if isinstance(task, str) else task.get("title", str(task))
            elements.append(Paragraph(f"\u2022 {_safe(task_text)}", styles["bullet"]))

        elements.append(Spacer(1, 4))


def _add_appendix(elements: list, state: dict, styles: dict) -> None:
    """Section 6 — Appendix: Source Feedback."""
    elements.append(Paragraph("Appendix: Source Feedback", styles["heading"]))

    items = state.get("feedback_items", [])
    if not items:
        elements.append(Paragraph("No source feedback available.", styles["body"]))
        return

    avail_w = PAGE_W - 2 * MARGIN
    col_widths = [avail_w * 0.15, avail_w * 0.30, avail_w * 0.20, avail_w * 0.35]

    header = ["Item ID", "Source", "Severity", "Sentiment"]
    rows = [header]

    max_rows = 200
    display_items = items[:max_rows]

    for idx, item in enumerate(display_items):
        if isinstance(item, dict):
            item_id = _safe(str(item.get("id", item.get("item_id", idx + 1))))
            source = _safe(str(item.get("source", "unknown")), max_len=40)
            severity = _safe(str(item.get("severity", "N/A")))
            sentiment = _safe(str(item.get("sentiment", item.get("emotion", "N/A"))))
        else:
            item_id = str(idx + 1)
            source = _safe(str(item), max_len=40)
            severity = "N/A"
            sentiment = "N/A"
        rows.append([item_id, source, severity, sentiment])

    table = Table(rows, colWidths=col_widths, repeatRows=1)
    style_cmds = list(_HEADER_STYLE) + _alternate_row_colours(len(rows))
    table.setStyle(TableStyle(style_cmds))
    elements.append(table)

    if len(items) > max_rows:
        remaining = len(items) - max_rows
        elements.append(Spacer(1, 6))
        elements.append(Paragraph(
            f"{remaining} additional items not shown.", styles["body_italic"],
        ))


# ============================================================
# Public API
# ============================================================

def export_prd(state: dict) -> bytes:
    """
    Build a styled PRD as PDF bytes.

    Args:
        state: Pipeline state dict with pattern_cards, prioritized_features,
               spec, feedback_items, session_id, etc.

    Returns:
        PDF file content as bytes.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
    )

    styles = _build_styles()
    elements: list = []

    _add_header(elements, state, styles)
    _add_executive_summary(elements, state, styles)
    _add_patterns(elements, state, styles)
    _add_features(elements, state, styles)
    _add_spec(elements, state, styles)
    _add_appendix(elements, state, styles)

    doc.build(elements, onFirstPage=_add_page_number, onLaterPages=_add_page_number)

    return buffer.getvalue()
