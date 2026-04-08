"""
Napkin — GitHub Repo Connector (Add-on 3)
Connects to a GitHub repository via OAuth, syncs repo context, and uses Claude
to build a "product context" summary of what's been built, what's in progress,
and what's planned.
"""

import json
import base64
import httpx
import structlog

from datetime import datetime, UTC, timedelta
from uuid import uuid4

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.config import get_settings
from app.core.llm import get_strong_llm
from app.db.client import get_supabase_admin

logger = structlog.get_logger(__name__)

GITHUB_API = "https://api.github.com"
GITHUB_OAUTH_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"


# ======================================================================
# OAuth Flow
# ======================================================================

async def start_github_oauth(
    project_id: str,
    user_id: str,
    redirect_uri: str,
) -> str:
    """
    Build and return the GitHub OAuth authorization URL.
    The PM clicks this to grant repo access.
    """
    settings = get_settings()

    if not settings.github_client_id:
        raise ValueError("GitHub OAuth not configured: github_client_id is missing")

    # State encodes project + user so we can associate on callback
    state = json.dumps({"project_id": project_id, "user_id": user_id})
    state_encoded = base64.urlsafe_b64encode(state.encode()).decode()

    params = {
        "client_id": settings.github_client_id,
        "redirect_uri": redirect_uri,
        "scope": "repo read:org",
        "state": state_encoded,
    }
    query = "&".join(f"{k}={httpx.QueryParams({k: v})}" for k, v in params.items())
    # Build URL properly
    url = f"{GITHUB_OAUTH_URL}?{httpx.QueryParams(params)}"

    logger.info(
        "github.oauth_started",
        project_id=project_id,
        user_id=user_id,
    )
    return url


async def handle_github_callback(
    code: str,
    project_id: str,
    user_id: str,
    redirect_uri: str,
) -> dict:
    """
    Exchange the OAuth code for an access token and store the integration.
    """
    settings = get_settings()
    db = get_supabase_admin()

    # Exchange code for token
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            GITHUB_TOKEN_URL,
            json={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
            },
            headers={"Accept": "application/json"},
        )
        resp.raise_for_status()
        token_data = resp.json()

    access_token = token_data.get("access_token")
    if not access_token:
        error = token_data.get("error_description", token_data.get("error", "Unknown"))
        logger.error("github.oauth_token_exchange_failed", error=error)
        raise ValueError(f"GitHub OAuth failed: {error}")

    # Fetch authenticated user info to confirm token works
    async with httpx.AsyncClient(timeout=30) as client:
        user_resp = await client.get(
            f"{GITHUB_API}/user",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
            },
        )
        user_resp.raise_for_status()
        gh_user = user_resp.json()

    # Upsert integration record
    integration = {
        "id": str(uuid4()),
        "project_id": project_id,
        "user_id": user_id,
        "provider": "github",
        "status": "active",
        "access_token": access_token,
        "config": {
            "github_login": gh_user.get("login"),
            "github_user_id": gh_user.get("id"),
            "scopes": token_data.get("scope", ""),
        },
        "created_at": datetime.now(UTC).isoformat(),
    }

    # Delete existing github integration for this project, then insert fresh
    try:
        db.table("integrations").delete().eq(
            "project_id", project_id
        ).eq("provider", "github").execute()
    except Exception:
        pass  # May not exist yet

    db.table("integrations").insert(integration).execute()

    logger.info(
        "github.oauth_complete",
        project_id=project_id,
        github_login=gh_user.get("login"),
    )

    return {
        "status": "connected",
        "github_login": gh_user.get("login"),
        "provider": "github",
    }


# ======================================================================
# Repo Context Sync
# ======================================================================

async def sync_repo_context(project_id: str) -> dict:
    """
    Fetch repository data from GitHub and use Claude to build a
    "product context" summary. Stores result in repo_contexts table.

    Steps:
    1. Get integration (access token + repo config)
    2. Fetch repo metadata, README, issues, PRs, commits, file tree
    3. Use Claude to synthesize a product context summary
    4. Upsert into repo_contexts
    5. Update integration.last_synced_at
    """
    db = get_supabase_admin()

    # 1. Get integration
    integration = _get_github_integration(db, project_id)
    if not integration:
        raise ValueError(f"No GitHub integration found for project {project_id}")

    access_token = integration["access_token"]
    config = integration.get("config") or {}
    repo_full_name = config.get("repo_full_name")

    if not repo_full_name:
        raise ValueError(
            "No repository configured. Set config.repo_full_name on the integration "
            "(e.g., 'owner/repo-name')."
        )

    owner, repo = repo_full_name.split("/", 1)
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
    }

    # 2. Fetch data from GitHub REST API
    async with httpx.AsyncClient(timeout=30.0) as client:
        repo_data = await _fetch_repo_info(client, headers, owner, repo)
        readme_content = await _fetch_readme(client, headers, owner, repo)
        open_issues = await _fetch_issues(client, headers, owner, repo)
        recent_prs = await _fetch_pull_requests(client, headers, owner, repo)
        recent_commits = await _fetch_commits(client, headers, owner, repo)
        file_tree = await _fetch_file_tree(
            client, headers, owner, repo,
            default_branch=repo_data.get("default_branch", "main"),
        )

    # 3. Use Claude to build product context summary
    llm = get_strong_llm()
    context_summary = await _build_product_context(
        llm=llm,
        repo_name=repo_full_name,
        repo_data=repo_data,
        readme_content=readme_content,
        open_issues=open_issues,
        recent_prs=recent_prs,
        recent_commits=recent_commits,
        file_tree=file_tree,
    )

    # 4. Upsert into repo_contexts
    now = datetime.now(UTC).isoformat()
    repo_context_row = {
        "project_id": project_id,
        "stack": context_summary.get("stack", []),
        "entities": context_summary.get("entities", []),
        "routes": context_summary.get("routes", []),
        "readme_content": (readme_content or "")[:10000],  # Cap stored README
        "repo_sha": repo_data.get("default_branch", "main"),
        "indexed_at": now,
        "is_stale": False,
    }

    # Try upsert: delete existing then insert
    try:
        db.table("repo_contexts").delete().eq("project_id", project_id).execute()
    except Exception:
        pass
    db.table("repo_contexts").insert(repo_context_row).execute()

    # 5. Update integration.last_synced_at
    try:
        db.table("integrations").update(
            {"config": {**config, "last_synced_at": now}}
        ).eq("id", integration["id"]).execute()
    except Exception as exc:
        logger.warning("github.update_sync_timestamp_failed", error=str(exc))

    logger.info(
        "github.repo_context_synced",
        project_id=project_id,
        repo=repo_full_name,
        stack=context_summary.get("stack", []),
        entities_count=len(context_summary.get("entities", [])),
    )

    return {
        "status": "synced",
        "repo": repo_full_name,
        "summary": context_summary,
        "indexed_at": now,
    }


async def get_repo_context(project_id: str) -> dict | None:
    """Fetch the latest repo_context for a project."""
    db = get_supabase_admin()
    try:
        result = (
            db.table("repo_contexts")
            .select("*")
            .eq("project_id", project_id)
            .order("indexed_at", desc=True)
            .limit(1)
            .execute()
        )
        data = result.data
        return data[0] if data else None
    except Exception as exc:
        logger.error("github.get_repo_context_failed", error=str(exc))
        return None


# ======================================================================
# GitHub API Fetchers
# ======================================================================

async def _fetch_repo_info(
    client: httpx.AsyncClient, headers: dict, owner: str, repo: str,
) -> dict:
    """GET /repos/{owner}/{repo} — basic repo metadata."""
    try:
        resp = await client.get(f"{GITHUB_API}/repos/{owner}/{repo}", headers=headers)
        resp.raise_for_status()
        data = resp.json()
        return {
            "name": data.get("name"),
            "full_name": data.get("full_name"),
            "description": data.get("description"),
            "default_branch": data.get("default_branch", "main"),
            "language": data.get("language"),
            "topics": data.get("topics", []),
            "open_issues_count": data.get("open_issues_count", 0),
            "stargazers_count": data.get("stargazers_count", 0),
            "created_at": data.get("created_at"),
            "updated_at": data.get("updated_at"),
        }
    except Exception as exc:
        logger.warning("github.fetch_repo_info_failed", error=str(exc))
        return {"default_branch": "main"}


async def _fetch_readme(
    client: httpx.AsyncClient, headers: dict, owner: str, repo: str,
) -> str | None:
    """GET /repos/{owner}/{repo}/readme — decode base64 content."""
    try:
        resp = await client.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/readme", headers=headers,
        )
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        data = resp.json()
        content_b64 = data.get("content", "")
        return base64.b64decode(content_b64).decode("utf-8", errors="replace")
    except Exception as exc:
        logger.warning("github.fetch_readme_failed", error=str(exc))
        return None


async def _fetch_issues(
    client: httpx.AsyncClient, headers: dict, owner: str, repo: str,
) -> list[dict]:
    """GET /repos/{owner}/{repo}/issues?state=open — open issues (title + labels)."""
    try:
        resp = await client.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/issues",
            headers=headers,
            params={"state": "open", "per_page": 30},
        )
        resp.raise_for_status()
        issues = resp.json()
        return [
            {
                "title": i.get("title"),
                "labels": [l.get("name") for l in i.get("labels", [])],
                "created_at": i.get("created_at"),
                "comments": i.get("comments", 0),
            }
            for i in issues
            if not i.get("pull_request")  # Filter out PRs (GitHub lists them here too)
        ]
    except Exception as exc:
        logger.warning("github.fetch_issues_failed", error=str(exc))
        return []


async def _fetch_pull_requests(
    client: httpx.AsyncClient, headers: dict, owner: str, repo: str,
) -> list[dict]:
    """GET /repos/{owner}/{repo}/pulls?state=all — recent PRs (title + state)."""
    try:
        resp = await client.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/pulls",
            headers=headers,
            params={"state": "all", "per_page": 30, "sort": "updated"},
        )
        resp.raise_for_status()
        prs = resp.json()
        return [
            {
                "title": pr.get("title"),
                "state": pr.get("state"),
                "merged": pr.get("merged_at") is not None,
                "created_at": pr.get("created_at"),
                "merged_at": pr.get("merged_at"),
            }
            for pr in prs
        ]
    except Exception as exc:
        logger.warning("github.fetch_prs_failed", error=str(exc))
        return []


async def _fetch_commits(
    client: httpx.AsyncClient, headers: dict, owner: str, repo: str,
) -> list[dict]:
    """GET /repos/{owner}/{repo}/commits — last 90 days of commit messages."""
    since = (datetime.now(UTC) - timedelta(days=90)).isoformat()
    try:
        resp = await client.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/commits",
            headers=headers,
            params={"per_page": 50, "since": since},
        )
        resp.raise_for_status()
        commits = resp.json()
        return [
            {
                "message": c.get("commit", {}).get("message", "").split("\n")[0],
                "date": c.get("commit", {}).get("author", {}).get("date"),
                "author": c.get("commit", {}).get("author", {}).get("name"),
            }
            for c in commits
        ]
    except Exception as exc:
        logger.warning("github.fetch_commits_failed", error=str(exc))
        return []


async def _fetch_file_tree(
    client: httpx.AsyncClient,
    headers: dict,
    owner: str,
    repo: str,
    default_branch: str = "main",
) -> list[str]:
    """GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1 — file tree, max depth 3."""
    try:
        resp = await client.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/{default_branch}",
            headers=headers,
            params={"recursive": "1"},
        )
        resp.raise_for_status()
        tree = resp.json().get("tree", [])
        # Filter to max depth 3 and return paths
        paths = []
        for item in tree:
            path = item.get("path", "")
            depth = path.count("/")
            if depth <= 3:
                paths.append(path)
        return paths
    except Exception as exc:
        logger.warning("github.fetch_file_tree_failed", error=str(exc))
        return []


# ======================================================================
# Claude Product Context Builder
# ======================================================================

async def _build_product_context(
    llm,
    repo_name: str,
    repo_data: dict,
    readme_content: str | None,
    open_issues: list[dict],
    recent_prs: list[dict],
    recent_commits: list[dict],
    file_tree: list[str],
) -> dict:
    """Use Claude to synthesize a product context summary from raw repo data."""

    # Build the input for Claude
    sections: list[str] = [f"Repository: {repo_name}"]

    if repo_data.get("description"):
        sections.append(f"Description: {repo_data['description']}")
    if repo_data.get("language"):
        sections.append(f"Primary Language: {repo_data['language']}")
    if repo_data.get("topics"):
        sections.append(f"Topics: {', '.join(repo_data['topics'])}")

    if readme_content:
        # Truncate very long READMEs
        readme_text = readme_content[:5000]
        if len(readme_content) > 5000:
            readme_text += "\n... [truncated]"
        sections.append(f"\n=== README ===\n{readme_text}")

    if file_tree:
        tree_text = "\n".join(file_tree[:300])
        sections.append(f"\n=== FILE TREE (up to depth 3) ===\n{tree_text}")

    if open_issues:
        issues_text = json.dumps(open_issues[:30], indent=1, default=str)
        sections.append(f"\n=== OPEN ISSUES ({len(open_issues)}) ===\n{issues_text}")

    if recent_prs:
        merged = [pr for pr in recent_prs if pr.get("merged")]
        open_prs = [pr for pr in recent_prs if pr.get("state") == "open"]
        if open_prs:
            sections.append(
                f"\n=== OPEN PRs ({len(open_prs)}) ===\n"
                + json.dumps(open_prs[:15], indent=1, default=str)
            )
        if merged:
            sections.append(
                f"\n=== RECENTLY MERGED PRs ({len(merged)}) ===\n"
                + json.dumps(merged[:15], indent=1, default=str)
            )

    if recent_commits:
        commits_text = json.dumps(recent_commits[:30], indent=1, default=str)
        sections.append(f"\n=== RECENT COMMITS (last 90 days) ===\n{commits_text}")

    input_text = "\n".join(sections)

    try:
        response = await llm.ainvoke([
            SystemMessage(content="""You are a senior engineer analyzing a GitHub repository to understand the product.

Produce a JSON summary with exactly these keys:

{
  "what_has_been_built": "2-4 sentence summary of the product based on README + file structure",
  "whats_in_progress": "Summary of active work based on open PRs + recent commits",
  "recently_shipped": "Summary of what was recently completed based on merged PRs + commit messages",
  "known_but_not_done": "Summary of planned/known work based on open issues",
  "stack": ["list", "of", "technologies", "detected"],
  "entities": ["key", "domain", "entities", "in", "the", "codebase"],
  "routes": ["list of API routes or key pages if detectable"],
  "architecture_notes": "Brief description of the architecture pattern (monolith, microservices, etc.)"
}

Be specific. Reference actual file names, PR titles, issue titles. Do not guess if data is missing — just say "Not enough data to determine" for that section.
Output ONLY valid JSON — no markdown fences, no extra text."""),
            HumanMessage(content=f"Analyze this repository:\n\n{input_text}"),
        ])

        content = response.content if hasattr(response, "content") else str(response)
        # Strip markdown fences if present
        content = content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1] if "\n" in content else content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        summary = json.loads(content)
    except json.JSONDecodeError as exc:
        logger.warning("github.product_context_parse_failed", error=str(exc))
        summary = _fallback_context(repo_data, file_tree, open_issues, recent_prs)
    except Exception as exc:
        logger.error("github.product_context_llm_failed", error=str(exc))
        summary = _fallback_context(repo_data, file_tree, open_issues, recent_prs)

    # Ensure required keys exist
    summary.setdefault("what_has_been_built", "")
    summary.setdefault("whats_in_progress", "")
    summary.setdefault("recently_shipped", "")
    summary.setdefault("known_but_not_done", "")
    summary.setdefault("stack", [])
    summary.setdefault("entities", [])
    summary.setdefault("routes", [])
    summary.setdefault("architecture_notes", "")

    return summary


def _fallback_context(
    repo_data: dict,
    file_tree: list[str],
    open_issues: list[dict],
    recent_prs: list[dict],
) -> dict:
    """Fallback context when Claude fails — extract what we can mechanically."""
    # Detect stack from file extensions
    stack = set()
    extension_map = {
        ".py": "Python", ".js": "JavaScript", ".ts": "TypeScript",
        ".tsx": "React/TypeScript", ".jsx": "React", ".go": "Go",
        ".rs": "Rust", ".java": "Java", ".rb": "Ruby",
        ".vue": "Vue.js", ".svelte": "Svelte",
    }
    for path in file_tree:
        for ext, tech in extension_map.items():
            if path.endswith(ext):
                stack.add(tech)

    config_tech = {
        "package.json": "Node.js", "requirements.txt": "Python",
        "Cargo.toml": "Rust", "go.mod": "Go", "Gemfile": "Ruby",
        "docker-compose.yml": "Docker", "Dockerfile": "Docker",
        "next.config": "Next.js", "nuxt.config": "Nuxt.js",
    }
    for path in file_tree:
        basename = path.split("/")[-1]
        for config_file, tech in config_tech.items():
            if basename.startswith(config_file):
                stack.add(tech)

    return {
        "what_has_been_built": repo_data.get("description", "Unable to determine"),
        "whats_in_progress": f"{len([p for p in recent_prs if p.get('state') == 'open'])} open PRs",
        "recently_shipped": f"{len([p for p in recent_prs if p.get('merged')])} recently merged PRs",
        "known_but_not_done": f"{len(open_issues)} open issues",
        "stack": sorted(stack),
        "entities": [],
        "routes": [],
        "architecture_notes": "",
    }


# ======================================================================
# Internal helpers
# ======================================================================

def _get_github_integration(db, project_id: str) -> dict | None:
    """Load the GitHub integration for a project."""
    try:
        result = (
            db.table("integrations")
            .select("*")
            .eq("project_id", project_id)
            .eq("provider", "github")
            .eq("status", "active")
            .limit(1)
            .execute()
        )
        data = result.data
        return data[0] if data else None
    except Exception as exc:
        logger.error("github.get_integration_failed", error=str(exc))
        return None
