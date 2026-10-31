from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass
class TextDelta:
    text: str


@dataclass
class ToolUse:
    id: str
    name: str
    input: Any


@dataclass
class TurnEnd:
    stop_reason: str | None
    #: Provider content blocks for the assistant turn. Passed back unchanged on the next request
    #: (this preserves thinking blocks, which must be replayed untouched).
    content: Any
    tool_uses: list[ToolUse] = field(default_factory=list)


LLMEvent = TextDelta | TurnEnd


class LLMClient(Protocol):
    def stream_turn(self, system: list[dict[str, Any]], messages: list[dict[str, Any]], tools: list[dict[str, Any]]) -> AsyncIterator[LLMEvent]: ...
