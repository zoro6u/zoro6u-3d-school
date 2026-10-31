import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.llm.mock import MockLLM
from app.llm.types import LLMEvent, TextDelta, ToolUse, TurnEnd
from app.main import create_app
from app.ratelimit import RateLimiter
from app.routes import chat as chat_route


def parse_sse(text: str) -> list[tuple[str, dict[str, Any]]]:
    events = []
    for block in text.strip().split("\n\n"):
        if not block.strip():
            continue
        lines = dict(line.split(": ", 1) for line in block.split("\n"))
        events.append((lines["event"], json.loads(lines["data"])))
    return events


class FakeLLM:
    """Plays back a fixed list of turns; records what it was sent."""

    def __init__(self, turns: list[list[LLMEvent] | Exception]) -> None:
        self.turns = turns
        self.calls: list[dict[str, Any]] = []

    async def stream_turn(self, system, messages, tools):
        self.calls.append({"system": system, "messages": [dict(m) for m in messages], "tools": tools})
        turn = self.turns[min(len(self.calls) - 1, len(self.turns) - 1)]
        if isinstance(turn, Exception):
            raise turn
        for ev in turn:
            yield ev


def text_turn(text: str, stop: str = "end_turn") -> list[LLMEvent]:
    return [TextDelta(text), TurnEnd(stop, [{"type": "text", "text": text}])]


def tool_turn(name: str, args: Any, text: str = "", tid: str = "t1") -> list[LLMEvent]:
    blocks: list[Any] = ([{"type": "text", "text": text}] if text else []) + [{"type": "tool_use", "id": tid, "name": name, "input": args}]
    evs: list[LLMEvent] = [TextDelta(text)] if text else []
    return [*evs, TurnEnd("tool_use", blocks, [ToolUse(tid, name, args)])]


@pytest.fixture
def make_client():
    def _make(llm: Any = None, **settings_kw: Any) -> TestClient:
        app = create_app()
        settings = Settings(_env_file=None, **settings_kw)
        app.dependency_overrides[get_settings] = lambda: settings
        app.dependency_overrides[chat_route.get_llm] = lambda: llm
        app.dependency_overrides[chat_route.get_limiter] = lambda: RateLimiter()
        return TestClient(app)

    return _make


@pytest.fixture
def mock_client(make_client):
    return make_client(MockLLM(delay=0), mock_llm=True)


def body(msg: str, lesson: str = "physics-oscillations", **kw: Any) -> dict[str, Any]:
    return {"lesson_id": lesson, "lang": "en", "mode": "explain", "messages": [{"role": "user", "content": msg}], **kw}
