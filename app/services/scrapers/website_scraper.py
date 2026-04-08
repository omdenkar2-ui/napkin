"""
Napkin — Website Scraper (Add-on 4)
Crawls a product website, extracts structured business context via LLM,
and stores it in `business_contexts` for downstream prompt enrichment.
"""

import json
import asyncio
from datetime import datetime, UTC
from urllib.parse import urljoin, urlparse

import httpx
import structlog
from bs4 import BeautifulSoup
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm import get_strong_llm
from app.db.client import get_supabase_admin

logger = structlog.get_logger(__name__)

# Pages we actively look for when discovering links
_INTERESTING_PATHS = {
    "pricing", "features", "about", "about-us", "blog",
    "product", "solutions", "customers", "use-cases", "docs",
}
_MAX_PAGES = 10
_FETCH_TIMEOUT = 15.0


# ================================================================
# PUBLIC API
# ================================================================

async def scrape_website(project_id: str, url: str) -> dict:
    """
    Scrape a product website, extract structured business context via
    Claude, and persist to Supabase.

    Returns the business-context dict on success, or raises on failure.
    """
    url = _normalize_url(url)
    domain = urlparse(url).netloc
    logger.info("scrape_website.start", project_id=project_id, url=url)

    # -- 1. Discover pages --------------------------------------------------
    pages_to_scrape = await _discover_pages(url, domain)
    logger.info(
        "scrape_website.pages_discovered",
        project_id=project_id,
        count=len(pages_to_scrape),
    )

    # -- 2. Fetch & parse each page in parallel -----------------------------
    raw_pages = await asyncio.gather(
        *[_fetch_and_parse(page_url) for page_url in pages_to_scrape],
        return_exceptions=True,
    )
    parsed_pages = [p for p in raw_pages if isinstance(p, dict)]
    if not parsed_pages:
        raise RuntimeError(f"Could not fetch any pages from {url}")

    logger.info(
        "scrape_website.pages_fetched",
        project_id=project_id,
        success=len(parsed_pages),
        failed=len(raw_pages) - len(parsed_pages),
    )

    # -- 3. LLM: extract structured business context ------------------------
    business_context = await _extract_business_context(parsed_pages, url)

    # -- 4. Persist to Supabase ---------------------------------------------
    db = get_supabase_admin()
    now = datetime.now(UTC).isoformat()

    # Upsert business_contexts (one row per project)
    ctx_row = {
        "project_id": project_id,
        "url": url,
        "product_name": business_context.get("product_name", ""),
        "core_value_prop": business_context.get("core_value_prop", ""),
        "target_customer": business_context.get("target_customer", ""),
        "key_features": business_context.get("key_features", []),
        "pricing_model": business_context.get("pricing_model", ""),
        "competitors": business_context.get("competitors_mentioned", []),
        "tone": business_context.get("tone", ""),
        "raw_pages": parsed_pages,
        "scraped_at": now,
        "is_stale": False,
    }
    db.table("business_contexts").upsert(
        ctx_row, on_conflict="project_id"
    ).execute()

    # Upsert integrations record
    db.table("integrations").upsert(
        {
            "project_id": project_id,
            "provider": "website",
            "status": "connected",
            "config": {"url": url},
        },
        on_conflict="project_id,provider",
    ).execute()

    logger.info(
        "scrape_website.done",
        project_id=project_id,
        product_name=business_context.get("product_name"),
    )
    return business_context


async def get_business_context(project_id: str) -> dict | None:
    """Fetch the latest business context for a project, or None."""
    db = get_supabase_admin()
    result = (
        db.table("business_contexts")
        .select("*")
        .eq("project_id", project_id)
        .limit(1)
        .execute()
    )
    rows = result.data
    return rows[0] if rows else None


# ================================================================
# INTERNAL HELPERS
# ================================================================

def _normalize_url(url: str) -> str:
    """Ensure the URL has a scheme."""
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"
    return url


async def _discover_pages(start_url: str, domain: str) -> list[str]:
    """
    Starting from *start_url*, find same-domain links to interesting
    sub-pages (pricing, features, about, etc.). Returns up to _MAX_PAGES
    unique URLs including the start URL itself.
    """
    pages: dict[str, bool] = {start_url: True}  # ordered dict preserves insertion

    try:
        async with httpx.AsyncClient(
            follow_redirects=True, timeout=_FETCH_TIMEOUT
        ) as client:
            resp = await client.get(start_url, headers=_headers())
            resp.raise_for_status()
    except Exception as exc:
        logger.warning("discover_pages.fetch_failed", url=start_url, error=str(exc))
        return [start_url]

    soup = BeautifulSoup(resp.text, "html.parser")

    for tag in soup.find_all("a", href=True):
        if len(pages) >= _MAX_PAGES:
            break
        href = tag["href"]
        absolute = urljoin(start_url, href)
        parsed = urlparse(absolute)

        # Same domain only
        if parsed.netloc != domain:
            continue

        # Strip fragments / query for dedup
        clean = f"{parsed.scheme}://{parsed.netloc}{parsed.path.rstrip('/')}"
        if clean in pages:
            continue

        # Check if the path looks interesting
        path_parts = {
            p.lower() for p in parsed.path.strip("/").split("/") if p
        }
        if path_parts & _INTERESTING_PATHS:
            pages[clean] = True

    return list(pages.keys())


async def _fetch_and_parse(url: str) -> dict:
    """Fetch a single page and return structured content."""
    async with httpx.AsyncClient(
        follow_redirects=True, timeout=_FETCH_TIMEOUT
    ) as client:
        resp = await client.get(url, headers=_headers())
        resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")

    # Remove noise
    for tag in soup(["script", "style", "nav", "footer", "noscript", "svg"]):
        tag.decompose()

    title = soup.title.string.strip() if soup.title and soup.title.string else ""
    meta_desc = ""
    meta_tag = soup.find("meta", attrs={"name": "description"})
    if meta_tag and meta_tag.get("content"):
        meta_desc = meta_tag["content"].strip()

    headings = []
    for level in ("h1", "h2", "h3"):
        for h in soup.find_all(level):
            text = h.get_text(strip=True)
            if text:
                headings.append({"level": level, "text": text})

    paragraphs = [
        p.get_text(strip=True)
        for p in soup.find_all("p")
        if p.get_text(strip=True)
    ]

    list_items = [
        li.get_text(strip=True)
        for li in soup.find_all("li")
        if li.get_text(strip=True)
    ]

    return {
        "url": url,
        "title": title,
        "meta_description": meta_desc,
        "headings": headings[:50],
        "paragraphs": paragraphs[:80],
        "list_items": list_items[:60],
    }


async def _extract_business_context(pages: list[dict], source_url: str) -> dict:
    """Use Claude (strong LLM) to distill pages into structured business context."""
    llm = get_strong_llm()

    # Build a concise text representation of the scraped pages
    page_summaries = []
    for p in pages:
        parts = [f"## {p['title']} ({p['url']})"]
        if p.get("meta_description"):
            parts.append(f"Meta: {p['meta_description']}")
        for h in p.get("headings", [])[:15]:
            parts.append(f"  {h['level'].upper()}: {h['text']}")
        for para in p.get("paragraphs", [])[:20]:
            parts.append(f"  {para[:300]}")
        for li in p.get("list_items", [])[:15]:
            parts.append(f"  - {li[:200]}")
        page_summaries.append("\n".join(parts))

    all_text = "\n\n---\n\n".join(page_summaries)
    # Truncate to avoid token limits
    if len(all_text) > 60_000:
        all_text = all_text[:60_000] + "\n\n[...truncated]"

    response = await llm.ainvoke([
        SystemMessage(content="""You are a product analyst. Given scraped website pages,
extract a structured business context. Return ONLY valid JSON (no markdown fences):

{
  "product_name": "The product/company name",
  "core_value_prop": "1-2 sentence value proposition",
  "target_customer": "Who the product is for",
  "key_features": ["feature1", "feature2", ...],
  "pricing_model": "Free / Freemium / Subscription / Enterprise / Usage-based / Unknown",
  "competitors_mentioned": ["competitor1", ...],
  "tone": "professional / casual / technical / enterprise / startup"
}

Rules:
- Be specific and factual — only state what the website actually says.
- For key_features, list up to 8 of the most prominent features.
- For competitors_mentioned, list only those explicitly named on the site. Empty list is fine.
- For pricing_model, infer from the pricing page if available, otherwise "Unknown".
- For tone, pick the single best descriptor."""),
        HumanMessage(content=f"Website: {source_url}\n\nScraped pages:\n\n{all_text}"),
    ])

    content = response.content if hasattr(response, "content") else str(response)

    # Strip markdown fences if present
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1] if "\n" in content else content[3:]
    if content.endswith("```"):
        content = content[:-3]
    content = content.strip()

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        logger.warning(
            "extract_business_context.json_parse_failed",
            raw_content=content[:500],
        )
        # Return a minimal fallback
        return {
            "product_name": pages[0].get("title", "Unknown"),
            "core_value_prop": pages[0].get("meta_description", ""),
            "target_customer": "Unknown",
            "key_features": [],
            "pricing_model": "Unknown",
            "competitors_mentioned": [],
            "tone": "unknown",
        }


def _headers() -> dict[str, str]:
    """Standard request headers to look like a real browser."""
    return {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
