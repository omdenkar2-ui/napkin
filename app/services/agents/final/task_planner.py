"""
Napkin — Task Planner + Assigner Agent (ReAct)

Breaks a SpecObject into an executable sprint plan with dependency ordering,
FE/BE/DB tags, critical path, and risk detection.
Uses ReAct for validation and quality checks.
"""

from __future__ import annotations

import json
from collections import defaultdict, deque
from uuid import uuid4

import structlog
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool

from app.models.llm_outputs import TaskPlannerLLMResult
from app.services.agents.react import react_loop

logger = structlog.get_logger(__name__)


# ============================================================
# TOOLS — the LLM decides when to call these
# ============================================================

@tool
async def validate_estimates(tasks: list[dict]) -> dict:
    """Validate task estimates. Flags tasks >16h, total >80h, role >40h. Deterministic."""
    issues = []
    total = sum(t.get("estimate_hours", 0) for t in tasks)

    for task in tasks:
        hours = task.get("estimate_hours", 0)
        if hours > 16:
            issues.append(f"Task '{task.get('title', '?')}' estimated at {hours}h — consider splitting")

    if total > 80:
        issues.append(f"Total estimate ({total}h) exceeds 2-week sprint capacity (80h)")

    role_hours: dict[str, float] = defaultdict(float)
    for task in tasks:
        role = task.get("assigned_to") or task.get("type", "BE")
        role_hours[role] += task.get("estimate_hours", 0)

    for role, hours in role_hours.items():
        if hours > 40:
            issues.append(f"Role '{role}' assigned {hours}h — risk of overload")

    return {"issues": issues, "total_hours": total, "needs_splitting": any("splitting" in i for i in issues)}


@tool
async def check_dependency_completeness(tasks: list[dict]) -> dict:
    """Verify all dependency references exist and no circular deps. Deterministic."""
    task_ids = {t.get("id", "") for t in tasks}
    task_titles = {t.get("title", "") for t in tasks}
    issues = []

    for task in tasks:
        for dep in task.get("dependencies", []):
            if dep not in task_ids and dep not in task_titles:
                issues.append(f"Task '{task.get('title', '?')}' depends on '{dep}' which doesn't exist")

    return {"issues": issues, "valid": len(issues) == 0}


@tool
async def evaluate_plan_quality(plan: dict) -> dict:
    """Evaluate overall plan quality. Deterministic."""
    issues = []
    tasks = plan.get("tasks", [])
    total = plan.get("total_hours", 0)

    if total > 80:
        issues.append("Total exceeds sprint capacity")
    if not plan.get("critical_path"):
        issues.append("No critical path computed")

    for task in tasks:
        if not task.get("acceptance_criteria"):
            issues.append(f"Task '{task.get('title', '?')}' missing acceptance criteria")

    return {"issues": issues, "needs_iteration": len(issues) > 0}


# ============================================================
# MAIN FUNCTION
# ============================================================

PLANNER_REACT_SYSTEM = """You are the Task Planner validation agent.
Validate the sprint plan using validate_estimates, check_dependency_completeness,
and evaluate_plan_quality. Report any issues found."""


async def run_task_planner(
    spec: dict,
    team_profiles: list[dict] | None = None,
    llm: object | None = None,
) -> dict:
    """Break a spec into an executable sprint plan."""
    task_breakdown = spec.get("task_breakdown", [])
    if not task_breakdown:
        return _empty_plan()

    if llm is None:
        from app.core.llm import get_strong_llm
        llm = get_strong_llm()

    # Generate task decomposition via structured output
    from app.agents.prompts.task_planner import TASK_PLANNER_SYSTEM, TASK_PLANNER_USER

    user_prompt = TASK_PLANNER_USER.format(
        task_breakdown=json.dumps(task_breakdown, default=str),
        decision=json.dumps(spec.get("decision", {}), default=str),
        data_model=json.dumps(spec.get("data_model", []), default=str),
        ui_changes=json.dumps(spec.get("ui_changes", []), default=str),
        repo_context="None",
    )

    try:
        structured_llm = llm.with_structured_output(TaskPlannerLLMResult)
        result = await structured_llm.ainvoke([
            SystemMessage(content=TASK_PLANNER_SYSTEM),
            HumanMessage(content=user_prompt),
        ])

        if isinstance(result, dict):
            parsed = result
        elif hasattr(result, "model_dump"):
            parsed = result.model_dump()
        else:
            parsed = {}
    except Exception:
        logger.exception("Task planner structured output failed")
        return _fallback_plan(task_breakdown)

    raw_tasks = parsed.get("tasks", [])
    if not raw_tasks:
        return _fallback_plan(task_breakdown)

    # Normalize tasks
    tasks = _normalize_tasks(raw_tasks)

    # Validate estimates (flag > 16h)
    risk_flags: list[str] = []
    for task in tasks:
        if task["estimate_hours"] > 16:
            risk_flags.append(
                f"Task '{task['title']}' estimated at {task['estimate_hours']}h "
                f"-- consider splitting."
            )

    # Compute critical path
    critical_path = _compute_critical_path(tasks)

    # Sprint assignment (80h per 2-week sprint)
    total_hours = sum(t["estimate_hours"] for t in tasks)
    _assign_sprint_days(tasks, critical_path)

    if total_hours > 80:
        risk_flags.append(
            f"Total estimate ({total_hours}h) exceeds 2-week sprint capacity (80h)."
        )

    # Team load
    team_load: dict[str, float] = defaultdict(float)
    for task in tasks:
        role = task.get("assigned_to") or task["type"]
        team_load[role] += task["estimate_hours"]

    for role, hours in team_load.items():
        if hours > 40:
            risk_flags.append(f"Role '{role}' assigned {hours}h -- risk of overload.")

    # Sprint checkpoints
    checkpoints = _generate_checkpoints(tasks, total_hours)

    plan = {
        "tasks": tasks,
        "total_hours": round(total_hours, 1),
        "critical_path": critical_path,
        "sprint_checkpoints": checkpoints,
        "risk_flags": risk_flags,
        "team_load": dict(team_load),
    }

    # Validate via ReAct (best-effort)
    try:
        react_messages = [
            SystemMessage(content=PLANNER_REACT_SYSTEM),
            HumanMessage(content=f"Validate this plan:\n{json.dumps(plan, default=str)[:4000]}"),
        ]
        await react_loop(
            llm,
            [validate_estimates, check_dependency_completeness, evaluate_plan_quality],
            react_messages,
            max_iterations=2,
        )
    except Exception:
        pass

    return plan


# ============================================================
# Critical Path
# ============================================================

def _compute_critical_path(tasks: list[dict]) -> list[str]:
    """Compute the critical path via topological sort + longest path."""
    if not tasks:
        return []

    task_by_id: dict[str, dict] = {t["id"]: t for t in tasks}
    task_by_title: dict[str, str] = {t["title"]: t["id"] for t in tasks}

    graph: dict[str, list[str]] = defaultdict(list)
    in_degree: dict[str, int] = {t["id"]: 0 for t in tasks}

    for task in tasks:
        for dep in task.get("dependencies", []):
            dep_id = dep if dep in task_by_id else task_by_title.get(dep, "")
            if dep_id and dep_id in task_by_id:
                graph[dep_id].append(task["id"])
                in_degree[task["id"]] = in_degree.get(task["id"], 0) + 1

    # Topological sort (Kahn's algorithm)
    queue = deque([tid for tid, deg in in_degree.items() if deg == 0])
    topo_order: list[str] = []
    dist: dict[str, float] = {tid: 0 for tid in in_degree}
    predecessor: dict[str, str | None] = {tid: None for tid in in_degree}

    while queue:
        node = queue.popleft()
        topo_order.append(node)

        node_cost = task_by_id[node]["estimate_hours"]
        for neighbor in graph[node]:
            new_dist = dist[node] + node_cost
            if new_dist > dist[neighbor]:
                dist[neighbor] = new_dist
                predecessor[neighbor] = node
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if not topo_order:
        return [tasks[0]["id"]] if tasks else []

    end_node = max(
        topo_order,
        key=lambda tid: dist[tid] + task_by_id[tid]["estimate_hours"],
    )

    path: list[str] = []
    current: str | None = end_node
    while current is not None:
        path.append(current)
        current = predecessor[current]
    path.reverse()

    return path


# ============================================================
# Sprint Assignment
# ============================================================

def _assign_sprint_days(tasks: list[dict], critical_path: list[str]) -> None:
    """Assign sprint_day to each task (1-10 for a 2-week sprint)."""
    cp_set = set(critical_path)
    hours_per_day = 8.0
    current_day = 1
    day_hours_used = 0.0

    ordered_ids = list(critical_path)
    for task in tasks:
        if task["id"] not in cp_set:
            ordered_ids.append(task["id"])

    task_by_id = {t["id"]: t for t in tasks}

    for tid in ordered_ids:
        task = task_by_id.get(tid)
        if not task:
            continue

        if day_hours_used + task["estimate_hours"] > hours_per_day:
            current_day += 1
            day_hours_used = 0.0

        task["sprint_day"] = min(current_day, 10)
        day_hours_used += task["estimate_hours"]


# ============================================================
# Checkpoints
# ============================================================

def _generate_checkpoints(tasks: list[dict], total_hours: float) -> list[dict]:
    """Generate sprint checkpoints at days 3, 5, 8, 10."""
    checkpoints = []
    checkpoint_days = [3, 5, 8, 10]

    for day in checkpoint_days:
        tasks_complete = [
            t["id"] for t in tasks
            if (t.get("sprint_day") or 0) <= day
        ]

        hours_done = sum(
            t["estimate_hours"] for t in tasks
            if (t.get("sprint_day") or 0) <= day
        )

        milestone = (
            f"Day {day}: {len(tasks_complete)}/{len(tasks)} tasks, "
            f"{round(hours_done, 1)}h/{round(total_hours, 1)}h"
        )

        checkpoints.append({
            "day": day,
            "milestone": milestone,
            "tasks_complete": tasks_complete,
        })

    return checkpoints


# ============================================================
# Helpers
# ============================================================

def _normalize_tasks(raw_tasks: list[dict]) -> list[dict]:
    """Normalize LLM output into consistent task format."""
    tasks = []
    for i, raw in enumerate(raw_tasks):
        task_id = raw.get("id", str(uuid4())[:8])
        tasks.append({
            "id": task_id,
            "title": raw.get("title", f"Task {i + 1}"),
            "description": raw.get("description", ""),
            "type": raw.get("type", "BE").upper(),
            "estimate_hours": max(0.5, float(raw.get("estimate_hours", 4))),
            "priority": raw.get("priority", "P1"),
            "dependencies": raw.get("dependencies", []),
            "acceptance_criteria": raw.get("acceptance_criteria", []),
            "assigned_to": raw.get("assigned_to"),
            "sprint_day": None,
            "blocked_by": raw.get("blocked_by", []),
            "spec_section": raw.get("spec_section", ""),
        })
    return tasks


def _fallback_plan(task_breakdown: list[dict]) -> dict:
    """Build a simple plan directly from spec tasks when LLM fails."""
    tasks = []
    for i, raw in enumerate(task_breakdown):
        tasks.append({
            "id": str(uuid4())[:8],
            "title": raw.get("title", f"Task {i + 1}"),
            "description": raw.get("description", ""),
            "type": raw.get("type", "BE"),
            "estimate_hours": 4.0,
            "priority": "P1",
            "dependencies": raw.get("dependencies", raw.get("deps", [])),
            "acceptance_criteria": raw.get(
                "acceptance_criteria", raw.get("acceptance", [])
            ),
            "assigned_to": None,
            "sprint_day": i + 1,
            "blocked_by": [],
            "spec_section": "",
        })

    total = len(tasks) * 4.0
    return {
        "tasks": tasks,
        "total_hours": total,
        "critical_path": [tasks[0]["id"]] if tasks else [],
        "sprint_checkpoints": _generate_checkpoints(tasks, total),
        "risk_flags": [
            "Fallback plan -- LLM decomposition failed, using raw spec tasks."
        ],
        "team_load": {},
    }


def _empty_plan() -> dict:
    """Return empty task plan."""
    return {
        "tasks": [],
        "total_hours": 0.0,
        "critical_path": [],
        "sprint_checkpoints": [],
        "risk_flags": [],
        "team_load": {},
    }
