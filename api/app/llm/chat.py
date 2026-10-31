"""The tool-use loop: stream text, validate every tool call, feed results back, repeat (bounded)."""

import json
from collections.abc import AsyncIterator, Callable
from typing import Any

from app.content import Lesson
from app.llm.anthropic_client import classify_error
from app.llm.tools import validate_tool_call
from app.llm.types import LLMClient, TextDelta, TurnEnd

Event = tuple[str, dict[str, Any]]


def sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def run_chat(
    llm: LLMClient,
    lesson: Lesson,
    system: list[dict[str, Any]],
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]],
    *,
    max_rounds: int = 3,
    classify: Callable[[BaseException], tuple[str, str]] = classify_error,
) -> AsyncIterator[Event]:
    """Yields ('text'|'action'|'done'|'error', payload). Tool calls the validator rejects never become actions."""
    messages = list(messages)
    try:
        for round_no in range(max_rounds):
            if round_no > 0:
                # Text after a tool call is a new content block; keep it from gluing onto the previous sentence.
                yield "text", {"text": " "}
            turn: TurnEnd | None = None
            async for ev in llm.stream_turn(system, messages, tools):
                if isinstance(ev, TextDelta):
                    yield "text", {"text": ev.text}
                else:
                    turn = ev
            if turn is None:
                yield "error", {"code": "llm_error", "message": "No response from the teacher."}
                return
            if turn.stop_reason == "refusal":
                yield "error", {"code": "refusal", "message": "I can't help with that one. Let's get back to the science in the lab!"}
                return
            if turn.stop_reason == "max_tokens" and turn.tool_uses:
                # A truncated tool call may be half-formed: never run it.
                yield "error", {"code": "truncated", "message": "My answer got cut off. Could you ask again?"}
                return
            if turn.stop_reason != "tool_use" or not turn.tool_uses:
                yield "done", {"stop_reason": turn.stop_reason or "end_turn"}
                return

            messages.append({"role": "assistant", "content": turn.content})
            results: list[dict[str, Any]] = []
            for tu in turn.tool_uses:
                check = validate_tool_call(lesson.raw, tu.name, tu.input)
                if check.ok:
                    yield "action", check.action  # type: ignore[misc]
                    results.append({"type": "tool_result", "tool_use_id": tu.id, "content": check.message})
                else:
                    results.append({"type": "tool_result", "tool_use_id": tu.id, "is_error": True, "content": check.message})
            messages.append({"role": "user", "content": results})
        yield "error", {"code": "too_many_tool_rounds", "message": "I got a bit carried away. Let's try that again."}
    except Exception as exc:  # noqa: BLE001 - every upstream failure becomes a safe, structured SSE error
        code, message = classify(exc)
        yield "error", {"code": code, "message": message}
