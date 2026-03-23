"""
Napkin — Shared ReAct Loop Utility
Reason-Act-Observe loop used by all agents. The LLM picks tools,
code executes them, LLM sees results, and loops until satisfied.
"""

from __future__ import annotations

import json
from typing import Any

import structlog
from langchain_core.messages import AIMessage, ToolMessage

logger = structlog.get_logger(__name__)


async def react_loop(
    llm: Any,
    tools: list[Any],
    messages: list[Any],
    max_iterations: int = 5,
) -> AIMessage:
    """Run a ReAct (Reason-Act-Observe) loop.

    The LLM is given tools via bind_tools(). On each iteration:
    1. LLM reasons and optionally calls tools
    2. If no tool calls → LLM is satisfied, return response
    3. If tool calls → execute them, append results, loop

    Args:
        llm: A LangChain chat model (ChatAnthropic, etc.)
        tools: List of LangChain @tool-decorated functions
        messages: Initial message list (system + human)
        max_iterations: Safety cap on loop iterations

    Returns:
        The final AIMessage from the LLM (after it decides to stop calling tools)
    """
    if not tools:
        # No tools → single LLM call, no loop
        response = await llm.ainvoke(messages)
        return response

    tool_map = {t.name: t for t in tools}
    llm_with_tools = llm.bind_tools(tools)

    response = None
    for iteration in range(max_iterations):
        response = await llm_with_tools.ainvoke(messages)

        if not response.tool_calls:
            logger.debug("react_loop.done", iteration=iteration)
            return response

        messages.append(response)

        for tc in response.tool_calls:
            tool_name = tc["name"]
            tool_args = tc["args"]
            tool_call_id = tc["id"]

            if tool_name not in tool_map:
                logger.warning("react_loop.unknown_tool", tool=tool_name)
                messages.append(
                    ToolMessage(
                        content=f"Error: Unknown tool '{tool_name}'",
                        tool_call_id=tool_call_id,
                    )
                )
                continue

            try:
                fn = tool_map[tool_name]
                result = await fn.ainvoke(tool_args)
                result_str = json.dumps(result, default=str) if not isinstance(result, str) else result
            except Exception as exc:
                logger.error("react_loop.tool_error", tool=tool_name, error=str(exc))
                result_str = f"Error executing {tool_name}: {exc}"

            messages.append(
                ToolMessage(content=result_str, tool_call_id=tool_call_id)
            )

        logger.debug("react_loop.iteration", iteration=iteration, tool_calls=len(response.tool_calls))

    logger.warning("react_loop.max_iterations", max_iterations=max_iterations)
    return response
