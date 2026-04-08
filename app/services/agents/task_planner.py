"""
Napkin — Task Planner
Breaks a SpecObject into an executable sprint plan with dependency ordering,
FE/BE/DB tags, critical path, and risk detection.
Single LLM call + deterministic computation. No ReAct.
"""

import json
from collections import defaultdict, deque
from uuid import uuid4

import structlog
from langchain_core.messages import HumanMessage, SystemMessage

from app.services.agents.prompts import TASK_PLANNER_SYSTEM, TASK_PLANNER_USER
from app.models.llm_outputs import TaskPlannerLLMResult

logger = structlog.get_logger(__name__)


async def run_task_planner(
    spec: dict,
    llm: object | None = None,
) -> dict:
    """Break a spec into an executable sprint plan."""
    task_breakdown = spec.get("task_breakdown", [])
    if not task_breakdown:
        return _empty_plan()

    if llm is None:
        from app.core.llm import get_fast_llm
        llm = get_fast_llm()

    # Single LLM call for task decomposition (Haiku — structured output task)
    try:
        structured_llm = llm.with_structured_output(TaskPlannerLLMResult)
        result = await structured_llm.ainvoke([
            SystemMessage(content=TASK_PLANNER_SYSTEM),
            HumanMessage(content=TASK_PLANNER_USER.format(
                task_breakdown=json.dumps(task_breakdown, default=str),
                decision=json.dumps(spec.get("decision", {}), default=str),
                data_model=json.dumps(spec.get("data_model", []), default=str),
                ui_changes=json.dumps(spec.get("ui_changes", []), default=str),
                repo_context="None",
            )),
        ])

        parsed = result.model_dump() if hasattr(result, "model_dump") else (result if isinstance(result, dict) else {})
    except Exception:
        logger.exception("task_planner_llm_failed")
        return _fallback_plan(task_breakdown)

    raw_tasks = parsed.get("tasks", [])
    if not raw_tasks:
        return _fallback_plan(task_breakdown)

    # Normalize tasks
    tasks = _normalize_tasks(raw_tasks)

    # Deterministic computations
    risk_flags: list[str] = []
    for task in tasks:
        if task["estimate_hours"] > 16:
            risk_flags.append(f"Task '{task['title']}' estimated at {task['estimate_hours']}h — consider splitting")

    critical_path = _compute_critical_path(tasks)

    total_hours = sum(t["estimate_hours"] for t in tasks)
    _assign_sprint_days(tasks, critical_path)

    if total_hours > 80:
        risk_flags.append(f"Total estimate ({total_hours}h) exceeds 2-week sprint capacity (80h)")

    team_load: dict[str, float] = defaultdict(float)
    for task in tasks:
        role = task.get("assigned_to") or task["type"]
        team_load[role] += task["estimate_hours"]

    for role, hours in team_load.items():
        if hours > 40:
            risk_flags.append(f"Role '{role}' assigned {hours}h — risk of overload")

    checkpoints = _generate_checkpoints(tasks, total_hours)

    plan = {
        "tasks": tasks,
        "total_hours": round(total_hours, 1),
        "critical_path": critical_path,
        "sprint_checkpoints": checkpoints,
        "risk_flags": risk_flags,
        "team_load": dict(team_load),
    }

    logger.info("task_plan_complete", tasks=len(tasks), hours=total_hours)
    return plan


def _compute_critical_path(tasks: list[dict]) -> list[str]:
    if not tasks:
        return []

    task_by_id = {t["id"]: t for t in tasks}
    task_by_title = {t["title"]: t["id"] for t in tasks}

    graph: dict[str, list[str]] = defaultdict(list)
    in_degree: dict[str, int] = {t["id"]: 0 for t in tasks}

    for task in tasks:
        for dep in task.get("dependencies", []):
            dep_id = dep if dep in task_by_id else task_by_title.get(dep, "")
            if dep_id and dep_id in task_by_id:
                graph[dep_id].append(task["id"])
                in_degree[task["id"]] = in_degree.get(task["id"], 0) + 1

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

    end_node = max(topo_order, key=lambda tid: dist[tid] + task_by_id[tid]["estimate_hours"])

    path: list[str] = []
    current: str | None = end_node
    while current is not None:
        path.append(current)
        current = predecessor[current]
    path.reverse()
    return path


def _assign_sprint_days(tasks: list[dict], critical_path: list[str]) -> None:
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


def _generate_checkpoints(tasks: list[dict], total_hours: float) -> list[dict]:
    checkpoints = []
    for day in [3, 5, 8, 10]:
        tasks_complete = [t["id"] for t in tasks if (t.get("sprint_day") or 0) <= day]
        hours_done = sum(t["estimate_hours"] for t in tasks if (t.get("sprint_day") or 0) <= day)
        checkpoints.append({
            "day": day,
            "milestone": f"Day {day}: {len(tasks_complete)}/{len(tasks)} tasks, {round(hours_done, 1)}h/{round(total_hours, 1)}h",
            "tasks_complete": tasks_complete,
        })
    return checkpoints


def _normalize_tasks(raw_tasks: list[dict]) -> list[dict]:
    tasks = []
    for i, raw in enumerate(raw_tasks):
        tasks.append({
            "id": raw.get("id", str(uuid4())[:8]),
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
            "acceptance_criteria": raw.get("acceptance_criteria", raw.get("acceptance", [])),
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
        "risk_flags": ["Fallback plan — LLM decomposition failed, using raw spec tasks."],
        "team_load": {},
    }


def _empty_plan() -> dict:
    return {
        "tasks": [],
        "total_hours": 0.0,
        "critical_path": [],
        "sprint_checkpoints": [],
        "risk_flags": [],
        "team_load": {},
    }
