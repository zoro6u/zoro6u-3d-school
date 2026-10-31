from collections.abc import AsyncIterator
from typing import Any

import anthropic

from app.config import Settings
from app.llm.types import LLMEvent, TextDelta, ToolUse, TurnEnd

FALLBACK_BETA = "server-side-fallback-2026-07-01"


class AnthropicLLM:
    """Streams one assistant turn from Claude. The API key is read from the environment and never leaves the server."""

    def __init__(self, settings: Settings, client: anthropic.AsyncAnthropic | None = None) -> None:
        self._settings = settings
        self._client = client or anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    async def stream_turn(
        self, system: list[dict[str, Any]], messages: list[dict[str, Any]], tools: list[dict[str, Any]]
    ) -> AsyncIterator[LLMEvent]:
        s = self._settings
        kwargs: dict[str, Any] = {
            "model": s.anthropic_model,
            "max_tokens": s.max_output_tokens,
            "system": system,
            "messages": messages,
            "output_config": {"effort": s.anthropic_effort},
        }
        if tools:
            kwargs["tools"] = tools  # tool_choice stays at its default ("auto"); forced choice is rejected on current models
        if s.anthropic_fallbacks:
            stream_cm = self._client.beta.messages.stream(**kwargs, betas=[FALLBACK_BETA], fallbacks="default")
        else:
            stream_cm = self._client.messages.stream(**kwargs)
        async with stream_cm as stream:
            async for event in stream:
                if event.type == "text":
                    yield TextDelta(event.text)
            final = await stream.get_final_message()
        uses = [ToolUse(b.id, b.name, b.input) for b in final.content if b.type == "tool_use"]
        yield TurnEnd(final.stop_reason, final.content, uses)


def classify_error(exc: BaseException) -> tuple[str, str]:
    """Map an SDK exception to a safe (code, message) for the client. Never includes keys or raw upstream text."""
    if isinstance(exc, anthropic.RateLimitError):
        return "busy", "The teacher is busy right now. Please try again in a moment."
    if isinstance(exc, anthropic.AuthenticationError | anthropic.PermissionDeniedError):
        return "llm_auth", "The teacher service is not configured correctly."
    if isinstance(exc, anthropic.APIConnectionError):
        return "network", "Could not reach the teacher service."
    if isinstance(exc, anthropic.APIStatusError) and exc.status_code >= 500:
        return "llm_unavailable", "The teacher service is having trouble. Please try again."
    return "llm_error", "Something went wrong while the teacher was answering."
