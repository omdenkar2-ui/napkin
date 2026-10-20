"""Optional enrichment and export payload preparation for the pipeline."""

from __future__ import annotations

from copy import deepcopy


async def synthesis_signals(project_id: str, signals: list[dict]) -> list[dict]:
    """Add resolved history to a private copy, keeping evidence unchanged."""
    enriched = deepcopy(signals)
    try:
        from app.services.session_lifecycle import get_resolved_patterns
        resolved_labels = await get_resolved_patterns(project_id)
    except Exception:
        resolved_labels = []
    if resolved_labels:
        resolved_ctx = "\n\n--- ALREADY RESOLVED (do not resurface these) ---\n"
        resolved_ctx += "\n".join(f"- {label}" for label in resolved_labels)
        for signal in enriched:
            if isinstance(signal, dict) and signal.get("raw_text"):
                signal["raw_text"] += resolved_ctx
    return enriched


async def load_repo_context(project_id: str) -> dict | None:
    """Load GitHub repo context for the project (if connected)."""
    try:
        from app.services.github.connector import get_repo_context
        return await get_repo_context(project_id)
    except Exception:
        return None


async def load_business_context(project_id: str) -> dict | None:
    """Load website business context for the project (if scraped)."""
    try:
        from app.services.scrapers.website_scraper import get_business_context
        return await get_business_context(project_id)
    except Exception:
        return None


def merge_contexts(repo_context: dict | None, business_context: dict | None) -> dict:
    """Merge repo + business context into a single enrichment dict for spec builder."""
    merged = {}
    if repo_context:
        merged["readme"] = repo_context.get("readme_content", "")
        merged["stack_guess"] = repo_context.get("stack")
        merged["routes_text"] = str(repo_context.get("routes", ""))
        merged["schema_text"] = repo_context.get("schema_snapshot", "")
    if business_context:
        merged["business_context"] = {
            "product_name": business_context.get("product_name", ""),
            "core_value_prop": business_context.get("core_value_prop", ""),
            "target_customer": business_context.get("target_customer", ""),
            "key_features": business_context.get("key_features", []),
            "pricing_model": business_context.get("pricing_model", ""),
            "competitors": business_context.get("competitors", []),
            "tone": business_context.get("tone", ""),
        }
    return merged


def build_export_state(
    session_id: str,
    signals: list[dict],
    pattern_report: dict,
    priorities: dict,
    spec: dict,
    four_q: dict,
    task_plan: dict,
) -> dict:
    """Build the state dict that export_service expects."""
    return {
        "session_id": session_id,
        "feedback_items": signals,
        "pattern_report": pattern_report,
        "prioritization_result": priorities,
        "spec_object": spec,
        "four_q_answers": four_q,
        "sprint_plan": task_plan,
        "stage_history": [],
        "repo_files": {},
        "repo_context": None,
    }
