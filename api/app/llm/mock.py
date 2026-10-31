"""
Scripted stand-in for Claude, enabled only with MOCK_LLM=true (developer / CI use).

It speaks the same event protocol as the real client, including a two-round tool call
(text + tool_use, then a follow-up after the tool result), so the SSE endpoint, the tool validator and the
frontend can be exercised end to end without an API key. It is NOT the offline fallback tour (that is client-side).
"""

import asyncio
import json
import re
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

from app.config import REPO_ROOT
from app.llm.types import LLMEvent, TextDelta, ToolUse, TurnEnd

# The scripted replies live in content/demo/teacher-script.json so the static demo build (web/src/demo) shares them.
# Shape: subject -> [(keywords, {"tool", "args"}, {lang: (intro, followup, socratic_followup)})]
_DATA = json.loads(Path(REPO_ROOT, "content/demo/teacher-script.json").read_text(encoding="utf-8"))
Script = tuple[tuple[str, ...], dict[str, Any] | None, dict[str, tuple[str, str, str]]]
SCRIPTS: dict[str, list[Script]] = {
    subject: [(tuple(s["keywords"]), s["call"], {lang: tuple(t) for lang, t in s["texts"].items()}) for s in items]  # type: ignore[misc]
    for subject, items in _DATA["scripts"].items()
}
DEFAULT: dict[str, tuple[str, str, str]] = {lang: tuple(t) for lang, t in _DATA["default"].items()}  # type: ignore[misc]


def _words(text: str) -> list[str]:
    return re.findall(r"\S+\s*", text)


class MockLLM:
    def __init__(self, delay: float = 0.02) -> None:
        self.delay = delay

    async def stream_turn(self, system: list[dict[str, Any]], messages: list[dict[str, Any]], tools: list[dict[str, Any]]) -> AsyncIterator[LLMEvent]:
        sys_text = "\n".join(b["text"] for b in system)
        subject = (re.search(r"the (\w+) teacher in 3D School", sys_text) or [None, "physics"])[1]
        lang = "ar" if "Reply in Arabic" in sys_text else "en"
        socratic = "Mode: SOCRATIC" in sys_text
        last = messages[-1]
        followup_round = isinstance(last["content"], list) and any(
            isinstance(b, dict) and b.get("type") == "tool_result" for b in last["content"]
        )
        if followup_round:
            user_text = self._first_user_text(messages)
            script = self._match(subject, user_text)
            _, followup, socratic_followup = (script[2] if script else DEFAULT)[lang]
            # If a tool errored, say so honestly instead of pretending it worked.
            errored = any(b.get("is_error") for b in last["content"])
            text = followup if script else (socratic_followup if socratic else followup)
            if script and socratic and not errored:
                text = socratic_followup
            async for ev in self._text(text):
                yield ev
            yield TurnEnd("end_turn", [{"type": "text", "text": text}])
            return

        user_text = last["content"] if isinstance(last["content"], str) else ""
        script = self._match(subject, user_text)
        if script is None:
            scene = self._scene(user_text)
            intro, body, q = DEFAULT[lang]
            text = (q if socratic else body)
            if scene.get("experiment") == "pendulum" and "angle_deg" in scene and lang == "en":
                text = f"I can see a pendulum at {scene['angle_deg']} degrees. " + text
            async for ev in self._text(text):
                yield ev
            yield TurnEnd("end_turn", [{"type": "text", "text": text}])
            return
        _, call, texts = script
        intro = texts[lang][0]
        async for ev in self._text(intro):
            yield ev
        tu = ToolUse("toolu_mock_1", call["tool"], call["args"])
        yield TurnEnd(
            "tool_use",
            [{"type": "text", "text": intro}, {"type": "tool_use", "id": tu.id, "name": tu.name, "input": tu.input}],
            [tu],
        )

    # -- helpers -----------------------------------------------------------------------
    async def _text(self, text: str) -> AsyncIterator[LLMEvent]:
        for w in _words(text):
            if self.delay:
                await asyncio.sleep(self.delay)
            yield TextDelta(w)

    @staticmethod
    def _first_user_text(messages: list[dict[str, Any]]) -> str:
        for m in reversed(messages):
            if m["role"] == "user" and isinstance(m["content"], str):
                return m["content"]
        return ""

    @staticmethod
    def _scene(text: str) -> dict[str, Any]:
        m = re.search(r"<scene_state>(.*?)</scene_state>", text, re.DOTALL)
        try:
            return json.loads(m.group(1)) if m else {}
        except json.JSONDecodeError:
            return {}

    @staticmethod
    def _match(subject: str, text: str) -> Script | None:
        body = re.sub(r"<scene_state>.*?</scene_state>", "", text, flags=re.DOTALL).lower()
        for script in SCRIPTS.get(subject, []):
            if any(k in body for k in script[0]):
                return (script[0], {"tool": script[1]["tool"], "args": script[1]["args"]}, script[2])  # type: ignore[index,return-value]
        return None
