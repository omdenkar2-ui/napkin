"""
Napkin — One-Click Action Generator (Add-on 5)
Turns session insights into ready-to-send GitHub issues, PRD snippets,
Slack messages, and sprint tickets.
"""

import json
import asyncio
from datetime import datetime, UTC
from uuid import uuid4

import httpx
import structlog
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.config import get_settings
from app.db.client import get_supabase_admin
from app.core.llm import get_fast_llm

logger = structlog.get_logger(__name__)


# ================================================================
# PUBLIC: Generate all actions for a session
# ================================================================

async def generate_actions_for_session(
    session_id: str,
    project_id: str,
    user_id: str,
) -> list[dict]:
    """
    Fetch session data, identify top patterns/opportunities (up to 3),
    and generate ALL action types for each in parallel.
    Returns a list of generated action dicts.
    """
    db = get_supabase_admin()

    # Load session
    result = (
        db.table("sessions")
        .select("pattern_report, spec_object, task_plan, decision_object")
        .eq("id", session_id)
        .single()
        .execute()
    )
    session = result.data
    if not session:
        raise ValueError(f"Session {session_id} not found")

    pattern_report = session.get("pattern_report") or {}
    spec = session.get("spec_object") or {}
    task_plan = session.get("task_plan") or {}

    # Collect top patterns/opportunities (up to 3)
    top_items = _pick_top_items(pattern_report, max_items=3)
    if not top_items:
        logger.warning(
            "generate_actions.no_patterns",
            session_id=session_id,
        )
        return []

    # Collect tasks from task_plan for sprint tickets
    tasks = task_plan.get("tasks", task_plan.get("sprints", []))
    if isinstance(tasks, list) and tasks and isinstance(tasks[0], dict) and "tasks" in tasks[0]:
        # Flatten sprints -> tasks
        tasks = [t for sprint in tasks for t in sprint.get("tasks", [])]

    # Build session title for Slack messages
    session_title = spec.get("title", pattern_report.get("top_pains", ["Session insights"])[0]
                             if pattern_report.get("top_pains") else "Session insights")

    # Generate actions sequentially to avoid hitting LLM rate limits
    actions = []
    for i, item in enumerate(top_items):
        # GitHub Issue
        r = await _safe_generate(generate_github_issue, item, spec, str(project_id), action_type="github_issue")
        if r:
            actions.append(r)

        # PRD Snippet
        r = await _safe_generate(generate_prd_snippet, item, spec, action_type="prd_snippet")
        if r:
            actions.append(r)

        # Sprint Ticket
        task = tasks[i] if i < len(tasks) else {}
        r = await _safe_generate(generate_sprint_ticket, task, item, action_type="sprint_ticket")
        if r:
            actions.append(r)

    # One Slack message summarizing all top items
    r = await _safe_generate(generate_slack_message, top_items, session_title, action_type="slack_message")
    if r:
        actions.append(r)

    # Persist all generated actions
    rows = []
    for action in actions:
        action_id = str(uuid4())
        action["id"] = action_id
        rows.append({
            "id": action_id,
            "session_id": str(session_id),
            "project_id": str(project_id),
            "user_id": str(user_id),
            "action_type": action["action_type"],
            "title": action.get("title", ""),
            "content": action.get("content", action),
            "status": "draft",
            "sent_at": None,
            "external_url": None,
        })

    if rows:
        db.table("generated_actions").insert(rows).execute()

    logger.info(
        "generate_actions.done",
        session_id=session_id,
        total_actions=len(actions),
    )
    return actions


# ================================================================
# GENERATORS: Individual action types
# ================================================================

async def generate_github_issue(
    pattern: dict, spec: dict, project_id: str,
) -> dict:
    """Generate a GitHub issue from a pattern and spec context."""
    llm = get_fast_llm()

    severity = pattern.get("severity", pattern.get("severity_score", 5))
    priority_label = (
        "P0-critical" if severity >= 8
        else "P1-high" if severity >= 6
        else "P2-medium" if severity >= 4
        else "P3-low"
    )

    prompt_context = json.dumps({
        "pattern": pattern,
        "spec_context": {
            k: spec.get(k)
            for k in ("title", "problem_statement", "goals", "requirements")
            if spec.get(k)
        },
    }, indent=2, default=str)

    response = await llm.ainvoke([
        SystemMessage(content="""You are a senior engineer writing a GitHub issue from product feedback analysis.
Output ONLY valid JSON (no markdown fences):
{
  "title": "Short, actionable issue title (under 80 chars)",
  "body": "Markdown body with these sections:\\n## Problem\\n...\\n## Proposed Solution\\n...\\n## Acceptance Criteria\\n- [ ] ...\\n## Evidence\\n..."
}

Rules:
- Title: imperative mood, specific (e.g., "Add bulk export for survey responses")
- Problem: describe the user pain with evidence quotes
- Proposed Solution: concrete technical approach
- Acceptance Criteria: 3-5 testable checkboxes
- Evidence: cite specific feedback/data that drives this issue"""),
        HumanMessage(content=f"Create a GitHub issue from this analysis:\n\n{prompt_context}"),
    ])

    parsed = _parse_llm_json(response)
    return {
        "action_type": "github_issue",
        "title": parsed.get("title", pattern.get("title", "Untitled issue")),
        "content": {
            "title": parsed.get("title", ""),
            "body": parsed.get("body", ""),
            "labels": ["feedback-driven", priority_label],
        },
    }


async def generate_prd_snippet(pattern: dict, spec: dict) -> dict:
    """Generate a mini-PRD snippet from a pattern."""
    llm = get_fast_llm()

    prompt_context = json.dumps({
        "pattern": pattern,
        "spec_context": {
            k: spec.get(k)
            for k in ("title", "problem_statement", "goals", "user_stories", "requirements")
            if spec.get(k)
        },
    }, indent=2, default=str)

    response = await llm.ainvoke([
        SystemMessage(content="""You are a product manager writing a mini-PRD (Product Requirements Document) section.
Output ONLY valid JSON (no markdown fences):
{
  "title": "Feature/initiative name",
  "sections": [
    {"heading": "Problem Statement", "content": "..."},
    {"heading": "User Stories", "content": "As a [user], I want [goal] so that [benefit]..."},
    {"heading": "Requirements", "content": "Functional and non-functional requirements..."},
    {"heading": "Success Metrics", "content": "How we measure success..."},
    {"heading": "Out of Scope", "content": "What this does NOT cover..."}
  ]
}

Rules:
- Problem Statement: specific user pain with evidence
- User Stories: 2-4 user stories in standard format
- Requirements: numbered list, mix of functional and non-functional
- Success Metrics: quantifiable where possible (adoption %, reduction in X)
- Out of Scope: prevent scope creep with clear boundaries"""),
        HumanMessage(content=f"Create a mini-PRD from this analysis:\n\n{prompt_context}"),
    ])

    parsed = _parse_llm_json(response)
    return {
        "action_type": "prd_snippet",
        "title": parsed.get("title", pattern.get("title", "Untitled PRD")),
        "content": parsed,
    }


async def generate_slack_message(
    patterns: list[dict], session_title: str,
) -> dict:
    """Generate a Slack stakeholder update summarizing top findings."""
    llm = get_fast_llm()

    findings_text = json.dumps(
        [
            {
                "title": p.get("title", p.get("label", "")),
                "description": p.get("description", p.get("pain_summary", "")),
                "severity": p.get("severity", p.get("severity_score", 5)),
                "evidence": p.get("evidence", p.get("evidence_quotes", []))[:2],
            }
            for p in patterns
        ],
        indent=2,
        default=str,
    )

    response = await llm.ainvoke([
        SystemMessage(content="""You are writing a Slack message to update stakeholders on customer feedback findings.
Output ONLY valid JSON (no markdown fences):
{
  "text": "Plain-text summary (used as fallback / notification text)",
  "blocks": [
    {"type": "header", "text": {"type": "plain_text", "text": "..."}},
    {"type": "section", "text": {"type": "mrkdwn", "text": "..."}},
    ...
  ]
}

The blocks should follow Slack Block Kit format and include:
1. A header with the session title
2. A brief context section (1-2 sentences)
3. Top 3 findings as numbered items with severity indicators
4. A recommended next step
5. A divider and footer

Use Slack mrkdwn: *bold*, _italic_, :emoji_name: for severity (e.g., :red_circle: critical, :large_orange_circle: high, :large_yellow_circle: medium).
Keep it concise and scannable."""),
        HumanMessage(content=f"Session: {session_title}\n\nTop findings:\n{findings_text}"),
    ])

    parsed = _parse_llm_json(response)
    return {
        "action_type": "slack_message",
        "title": f"Stakeholder Update: {session_title}",
        "content": parsed,
    }


async def generate_sprint_ticket(task: dict, pattern: dict) -> dict:
    """Generate a Jira-style sprint ticket."""
    llm = get_fast_llm()

    prompt_context = json.dumps({
        "task": task,
        "pattern": {
            "title": pattern.get("title", pattern.get("label", "")),
            "description": pattern.get("description", pattern.get("pain_summary", "")),
            "severity": pattern.get("severity", pattern.get("severity_score", 5)),
            "evidence": pattern.get("evidence", pattern.get("evidence_quotes", []))[:3],
        },
    }, indent=2, default=str)

    response = await llm.ainvoke([
        SystemMessage(content="""You are a scrum master creating a sprint ticket from feedback analysis.
Output ONLY valid JSON (no markdown fences):
{
  "title": "Short, specific ticket title",
  "description": "Detailed description with context and technical notes",
  "story_points": <number: 1, 2, 3, 5, 8, or 13>,
  "priority": "<P0|P1|P2|P3>",
  "labels": ["label1", "label2"],
  "acceptance_criteria": ["Criterion 1", "Criterion 2", ...]
}

Rules:
- story_points: 1=trivial, 2=small, 3=medium, 5=large, 8=very large, 13=epic-sized
- priority: P0=critical/blocker, P1=high/this sprint, P2=medium/next sprint, P3=low/backlog
- labels: infer from content (e.g., "bug", "feature", "ux", "backend", "frontend", "performance")
- acceptance_criteria: 3-5 specific, testable criteria
- description: include "Why" (user pain), "What" (proposed change), and "Context" (evidence)"""),
        HumanMessage(content=f"Create a sprint ticket:\n\n{prompt_context}"),
    ])

    parsed = _parse_llm_json(response)
    return {
        "action_type": "sprint_ticket",
        "title": parsed.get("title", task.get("title", pattern.get("title", "Untitled ticket"))),
        "content": parsed,
    }


# ================================================================
# SENDERS: Push actions to external services
# ================================================================

async def send_github_issue(action_id: str, project_id: str) -> dict:
    """
    Send a generated GitHub issue to the connected repository.
    Returns {url, issue_number} on success.
    """
    db = get_supabase_admin()

    # Get GitHub integration for this project
    integration = (
        db.table("integrations")
        .select("config")
        .eq("project_id", project_id)
        .eq("provider", "github")
        .single()
        .execute()
    ).data
    if not integration:
        raise ValueError(f"No GitHub integration found for project {project_id}")

    config = integration.get("config", {})
    access_token = config.get("access_token", "")
    repo_owner = config.get("repo_owner", "")
    repo_name = config.get("repo_name", "")
    if not all([access_token, repo_owner, repo_name]):
        raise ValueError("GitHub integration missing access_token, repo_owner, or repo_name")

    # Get the generated action
    action = (
        db.table("generated_actions")
        .select("content")
        .eq("id", action_id)
        .single()
        .execute()
    ).data
    if not action:
        raise ValueError(f"Action {action_id} not found")

    content = action.get("content", {})
    if isinstance(content, str):
        content = json.loads(content)

    # POST to GitHub
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"https://api.github.com/repos/{repo_owner}/{repo_name}/issues",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            json={
                "title": content.get("title", "Feedback-driven issue"),
                "body": content.get("body", ""),
                "labels": content.get("labels", ["feedback-driven"]),
            },
        )
        resp.raise_for_status()
        issue_data = resp.json()

    issue_url = issue_data.get("html_url", "")
    issue_number = issue_data.get("number", 0)

    # Update action status
    db.table("generated_actions").update({
        "status": "sent",
        "external_url": issue_url,
        "sent_at": datetime.now(UTC).isoformat(),
    }).eq("id", action_id).execute()

    # Create decision_log entry to track this issue through its lifecycle
    # Fetch session_id from generated_actions for linking
    action_full = (
        db.table("generated_actions")
        .select("session_id, project_id")
        .eq("id", action_id)
        .single()
        .execute()
    ).data or {}

    try:
        db.table("decision_log").insert({
            "id": str(uuid4()),
            "project_id": project_id,
            "session_id": action_full.get("session_id"),
            "decision_type": "build",
            "summary": content.get("title", "GitHub issue created by Napkin"),
            "reasoning": content.get("body", "")[:500],
            "outcome_status": "pending",
            "github_issue_number": issue_number,
            "github_issue_url": issue_url,
            "github_issue_state": "open",
        }).execute()
    except Exception as exc:
        logger.warning("send_github_issue.decision_log_failed", error=str(exc))

    logger.info(
        "send_github_issue.done",
        action_id=action_id,
        issue_number=issue_number,
        url=issue_url,
    )
    return {"url": issue_url, "issue_number": issue_number}


async def send_slack_message(action_id: str, project_id: str) -> dict:
    """
    Send a generated Slack message to the configured channel.
    Returns {ok, channel, ts} on success.
    """
    settings = get_settings()
    if not settings.slack_bot_token:
        raise ValueError("Slack bot token not configured (SLACK_BOT_TOKEN)")

    db = get_supabase_admin()

    # Get the generated action
    action = (
        db.table("generated_actions")
        .select("content")
        .eq("id", action_id)
        .single()
        .execute()
    ).data
    if not action:
        raise ValueError(f"Action {action_id} not found")

    content = action.get("content", {})
    if isinstance(content, str):
        content = json.loads(content)

    # Determine channel: project integration config > default
    channel = settings.slack_default_channel
    integration = (
        db.table("integrations")
        .select("config")
        .eq("project_id", project_id)
        .eq("provider", "slack")
        .limit(1)
        .execute()
    ).data
    if integration:
        channel = integration[0].get("config", {}).get("channel", channel)

    if not channel:
        raise ValueError("No Slack channel configured")

    # POST to Slack
    payload = {
        "channel": channel,
        "text": content.get("text", "Napkin feedback update"),
    }
    if content.get("blocks"):
        payload["blocks"] = content["blocks"]

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            "https://slack.com/api/chat.postMessage",
            headers={
                "Authorization": f"Bearer {settings.slack_bot_token}",
                "Content-Type": "application/json; charset=utf-8",
            },
            json=payload,
        )
        resp.raise_for_status()
        slack_data = resp.json()

    if not slack_data.get("ok"):
        raise RuntimeError(f"Slack API error: {slack_data.get('error', 'unknown')}")

    # Update action status
    db.table("generated_actions").update({
        "status": "sent",
        "sent_at": datetime.now(UTC).isoformat(),
    }).eq("id", action_id).execute()

    logger.info(
        "send_slack_message.done",
        action_id=action_id,
        channel=channel,
    )
    return {
        "ok": slack_data.get("ok"),
        "channel": slack_data.get("channel"),
        "ts": slack_data.get("ts"),
    }


# ================================================================
# INTERNAL HELPERS
# ================================================================

def _pick_top_items(pattern_report: dict, max_items: int = 3) -> list[dict]:
    """
    Extract the top patterns/opportunities from a pattern report.
    Pulls from critical_issues first, then valuable_insights,
    then future_opportunities.
    """
    items = []
    for key in ("critical_issues", "valuable_insights", "future_opportunities"):
        for item in pattern_report.get(key, []):
            items.append(item)
            if len(items) >= max_items:
                return items
    return items


async def _safe_generate(coro_func, *args, action_type: str = "") -> dict | None:
    """Run a generator coroutine, catch errors, return None on failure."""
    try:
        return await coro_func(*args)
    except Exception as exc:
        logger.warning(
            "action_generation_failed",
            action_type=action_type,
            error=str(exc),
        )
        return None


def _parse_llm_json(response) -> dict:
    """Extract JSON from an LLM response, handling markdown fences."""
    content = response.content if hasattr(response, "content") else str(response)
    content = content.strip()

    # Strip markdown fences
    if content.startswith("```"):
        content = content.split("\n", 1)[1] if "\n" in content else content[3:]
    if content.endswith("```"):
        content = content[:-3]
    content = content.strip()

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        logger.warning("parse_llm_json.failed", raw=content[:300])
        return {"raw": content}
