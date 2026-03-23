"""
Napkin — Repo Deep Context Agent (ReAct)

Analyzes a repository's files to produce a RepoContextPack that grounds
the Spec Builder in the user's actual codebase.
Uses structured output for entity/route extraction.
"""

from __future__ import annotations

import json
import re

import structlog
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool

from app.models.llm_outputs import EntityExtractionResult, RouteExtractionResult
from app.services.agents.react import react_loop

logger = structlog.get_logger(__name__)

# File patterns for selective indexing
_MODEL_PATTERNS = re.compile(
    r"(models?|schema|entities|types|domain)[/\\]", re.IGNORECASE
)
_ROUTE_PATTERNS = re.compile(
    r"(routes?|api|router|endpoint|controller)[/\\]", re.IGNORECASE
)
_AUTH_PATTERNS = re.compile(r"(auth|middleware[/\\]auth|guard|permission)", re.IGNORECASE)
_UI_PATTERNS = re.compile(
    r"(pages?|app[/\\]|views?|screens?|components?)[/\\]", re.IGNORECASE
)
_SKIP_PATTERNS = re.compile(
    r"(node_modules|\.git[/\\]|__pycache__|\.next|dist|build|vendor|\.venv|venv)",
    re.IGNORECASE,
)
_CONFIG_FILES = {
    "package.json",
    "pyproject.toml",
    "requirements.txt",
    "Cargo.toml",
    "go.mod",
    "Gemfile",
    "tsconfig.json",
    "docker-compose.yml",
    "docker-compose.yaml",
    "fly.toml",
    "vercel.json",
    "netlify.toml",
}


# ============================================================
# TOOLS — the LLM decides when to call these
# ============================================================

@tool
async def list_files(repo_files: dict) -> dict:
    """List all files in the repo with their sizes. Deterministic."""
    file_info = []
    for path, content in repo_files.items():
        file_info.append({"path": path, "size": len(content)})
    file_info.sort(key=lambda f: f["path"])
    return {"files": file_info, "total": len(file_info)}


@tool
async def read_file(path: str, repo_files: dict) -> dict:
    """Read a single file from the repo (up to 5000 chars)."""
    content = repo_files.get(path, "")
    return {"path": path, "content": content[:5000], "truncated": len(content) > 5000}


@tool
async def search_files(pattern: str, repo_files: dict) -> dict:
    """Regex search across all file contents. Returns matching paths + snippets."""
    matches = []
    try:
        regex = re.compile(pattern, re.IGNORECASE)
        for path, content in repo_files.items():
            found = regex.findall(content)
            if found:
                matches.append({"path": path, "match_count": len(found), "preview": found[:3]})
    except re.error:
        return {"error": f"Invalid regex: {pattern}", "matches": []}
    return {"matches": matches[:20], "total_matches": len(matches)}


@tool
async def evaluate_coverage(examined_files: list, total_files: list) -> dict:
    """Evaluate coverage of file examination. Deterministic."""
    total = len(total_files) if total_files else 1
    examined = len(examined_files)
    pct = examined / total if total > 0 else 0

    missed = []
    examined_set = set(examined_files)
    for f in total_files:
        if f not in examined_set:
            basename = f.replace("\\", "/").rsplit("/", 1)[-1].lower()
            if any(kw in basename for kw in ["model", "schema", "route", "api", "auth"]):
                missed.append(f)

    return {
        "files_examined": examined,
        "files_total": total,
        "coverage_pct": round(pct, 2),
        "missed_important_files": missed[:10],
        "needs_more_exploration": pct < 0.5 and len(missed) > 0,
    }


# ============================================================
# PUBLIC FUNCTIONS
# ============================================================

def detect_stack(repo_files: dict[str, str]) -> dict:
    """Deterministic stack detection from config files. No LLM needed."""
    stack: dict[str, str] = {}
    filenames = {_basename(p) for p in repo_files}
    lower_files = {p.lower(): content for p, content in repo_files.items()}

    # Language detection
    if "package.json" in filenames:
        stack["language"] = "javascript"
        pkg = _safe_json(repo_files, "package.json")
        deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}

        if "next" in deps:
            stack["framework"] = "next.js"
        elif "react" in deps:
            stack["framework"] = "react"
        elif "vue" in deps:
            stack["framework"] = "vue"
        elif "svelte" in deps or "@sveltejs/kit" in deps:
            stack["framework"] = "svelte"
        elif "express" in deps:
            stack["framework"] = "express"

        if "prisma" in deps or "@prisma/client" in deps:
            stack["orm"] = "prisma"
        elif "drizzle-orm" in deps:
            stack["orm"] = "drizzle"
        elif "typeorm" in deps:
            stack["orm"] = "typeorm"
        elif "sequelize" in deps:
            stack["orm"] = "sequelize"

    if "tsconfig.json" in filenames:
        stack["language"] = "typescript"

    if "pyproject.toml" in filenames or "requirements.txt" in filenames:
        stack.setdefault("language", "python")
        for path, content in repo_files.items():
            lower = content.lower()
            if "fastapi" in lower:
                stack["framework"] = "fastapi"
                break
            elif "django" in lower:
                stack["framework"] = "django"
                break
            elif "flask" in lower:
                stack["framework"] = "flask"
                break

        for path, content in repo_files.items():
            lower = content.lower()
            if "sqlalchemy" in lower:
                stack["orm"] = "sqlalchemy"
                break
            elif "tortoise" in lower:
                stack["orm"] = "tortoise"
                break

    if "Cargo.toml" in filenames:
        stack.setdefault("language", "rust")
    if "go.mod" in filenames:
        stack.setdefault("language", "go")
    if "Gemfile" in filenames:
        stack.setdefault("language", "ruby")

    # Database detection
    for content in repo_files.values():
        lower = content.lower()
        if "postgresql" in lower or "postgres" in lower or "psycopg" in lower:
            stack["database"] = "postgresql"
            break
        elif "mysql" in lower:
            stack["database"] = "mysql"
            break
        elif "mongodb" in lower or "mongoose" in lower:
            stack["database"] = "mongodb"
            break
        elif "sqlite" in lower:
            stack["database"] = "sqlite"
            break
        elif "supabase" in lower:
            stack["database"] = "supabase"
            break

    # Hosting detection
    if "fly.toml" in filenames:
        stack["hosting"] = "fly.io"
    elif "vercel.json" in filenames:
        stack["hosting"] = "vercel"
    elif "netlify.toml" in filenames:
        stack["hosting"] = "netlify"
    elif "docker-compose.yml" in filenames or "docker-compose.yaml" in filenames:
        stack["hosting"] = "docker"
    elif "Dockerfile" in filenames:
        stack["hosting"] = "docker"

    return stack


def select_files_for_indexing(
    repo_files: dict[str, str],
) -> dict[str, list[str]]:
    """Categorize files worth analyzing by type."""
    categories: dict[str, list[str]] = {
        "models": [],
        "routes": [],
        "auth": [],
        "ui": [],
        "config": [],
        "readme": [],
    }

    for path in repo_files:
        if _SKIP_PATTERNS.search(path):
            continue

        basename = _basename(path)

        if basename.lower().startswith("readme"):
            categories["readme"].append(path)
        elif basename in _CONFIG_FILES:
            categories["config"].append(path)
        elif _AUTH_PATTERNS.search(path):
            categories["auth"].append(path)
        elif _MODEL_PATTERNS.search(path):
            categories["models"].append(path)
        elif _ROUTE_PATTERNS.search(path):
            categories["routes"].append(path)
        elif _UI_PATTERNS.search(path):
            categories["ui"].append(path)

    return categories


async def extract_entities(
    files: dict[str, str], llm: object
) -> list[dict]:
    """Extract domain entities from model/schema files via structured output."""
    if not files:
        return []

    content_parts = []
    for path, content in list(files.items())[:20]:
        truncated = content[:3000]
        content_parts.append(f"--- {path} ---\n{truncated}")

    file_contents = "\n\n".join(content_parts)

    from app.agents.prompts.repo_context import REPO_CONTEXT_SYSTEM

    try:
        structured_llm = llm.with_structured_output(EntityExtractionResult)
        result = await structured_llm.ainvoke([
            SystemMessage(content=REPO_CONTEXT_SYSTEM),
            HumanMessage(content=(
                f"Extract ONLY the entities from these files. "
                f"Output entities with: name, fields (list of {{name, type}}), "
                f"relations (list of strings), file_path.\n\n{file_contents}"
            )),
        ])

        if isinstance(result, dict):
            return result.get("entities", [])
        if hasattr(result, "entities"):
            return [e.model_dump() if hasattr(e, "model_dump") else e for e in result.entities]
        if isinstance(result, list):
            return result
        return []
    except Exception:
        logger.exception("Entity extraction failed")
        return []


async def extract_routes(
    files: dict[str, str], llm: object
) -> list[dict]:
    """Extract API routes from route files via structured output."""
    if not files:
        return []

    content_parts = []
    for path, content in list(files.items())[:20]:
        truncated = content[:3000]
        content_parts.append(f"--- {path} ---\n{truncated}")

    file_contents = "\n\n".join(content_parts)

    try:
        structured_llm = llm.with_structured_output(RouteExtractionResult)
        result = await structured_llm.ainvoke([
            SystemMessage(content="Extract API routes from source files."),
            HumanMessage(content=(
                "Extract API routes from these files. "
                "Output routes with: method, path, handler, description, file_path.\n\n"
                f"{file_contents}"
            )),
        ])

        if isinstance(result, dict):
            return result.get("routes", [])
        if hasattr(result, "routes"):
            return [r.model_dump() if hasattr(r, "model_dump") else r for r in result.routes]
        if isinstance(result, list):
            return result
        return []
    except Exception:
        logger.exception("Route extraction failed")
        return []


async def run_repo_context(
    repo_files: dict[str, str],
    llm: object | None = None,
) -> dict:
    """Analyze repository files and produce a RepoContextPack."""
    if not repo_files:
        return {
            "stack": {},
            "entities": [],
            "routes": [],
            "auth_model": {"strategy": "unknown", "roles": [], "permissions": []},
            "ui_surfaces": [],
            "conventions": {},
            "readme_content": "",
            "file_tree": [],
        }

    if llm is None:
        from app.core.llm import get_fast_llm
        llm = get_fast_llm()

    # Step 1: Deterministic stack detection
    stack = detect_stack(repo_files)

    # Step 2: Categorize files
    categories = select_files_for_indexing(repo_files)

    # Step 3: LLM-based extraction via structured output
    model_files = {p: repo_files[p] for p in categories["models"] if p in repo_files}
    route_files = {p: repo_files[p] for p in categories["routes"] if p in repo_files}

    entities = await extract_entities(model_files, llm)
    routes = await extract_routes(route_files, llm)

    # Step 4: Build auth model from auth files
    auth_model: dict[str, str | list[str]] = {
        "strategy": "unknown",
        "roles": [],
        "permissions": [],
    }
    for path in categories["auth"]:
        content = repo_files.get(path, "").lower()
        if "jwt" in content:
            auth_model["strategy"] = "jwt"
        elif "session" in content:
            auth_model["strategy"] = "session"
        elif "oauth" in content:
            auth_model["strategy"] = "oauth"

    # Step 5: UI surfaces
    ui_surfaces = []
    for path in categories["ui"][:10]:
        ui_surfaces.append({
            "name": _basename(path).rsplit(".", 1)[0],
            "path": path,
            "components": [],
        })

    # Step 6: Conventions
    conventions: dict[str, str] = {}
    file_tree = sorted(repo_files.keys())
    if file_tree:
        has_src = any(p.startswith("src/") or p.startswith("src\\") for p in file_tree)
        conventions["folder_structure"] = "src-based" if has_src else "root-based"

        test_files = [p for p in file_tree if "test" in p.lower() or "spec" in p.lower()]
        if test_files:
            if any("__tests__" in p for p in test_files):
                conventions["test_pattern"] = "co-located __tests__"
            elif any(p.startswith("tests/") or p.startswith("test/") for p in test_files):
                conventions["test_pattern"] = "separate tests directory"
            else:
                conventions["test_pattern"] = "mixed"

    # Step 7: README
    readme_content = ""
    for path in categories["readme"]:
        readme_content = repo_files.get(path, "")[:5000]
        break

    return {
        "stack": stack,
        "entities": entities,
        "routes": routes,
        "auth_model": auth_model,
        "ui_surfaces": ui_surfaces,
        "conventions": conventions,
        "readme_content": readme_content,
        "file_tree": file_tree,
    }


# ============================================================
# Helpers
# ============================================================

def _basename(path: str) -> str:
    """Get the filename from a path (works with / and \\)."""
    return path.replace("\\", "/").rsplit("/", 1)[-1]


def _safe_json(repo_files: dict[str, str], filename: str) -> dict:
    """Try to parse a JSON config file from the repo."""
    for path, content in repo_files.items():
        if _basename(path) == filename:
            try:
                return json.loads(content)
            except (json.JSONDecodeError, ValueError):
                return {}
    return {}
