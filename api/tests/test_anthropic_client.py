"""Runs the real AnthropicLLM + real SDK stream parser against a fake HTTP transport that replays Messages-API SSE."""

import json

import anthropic
import httpx2 as httpx
import pytest

from app.config import Settings
from app.llm.anthropic_client import AnthropicLLM, classify_error
from app.llm.types import TextDelta, TurnEnd


def sse(*events: tuple[str, dict]) -> bytes:
    return "".join(f"event: {e}\ndata: {json.dumps(d)}\n\n" for e, d in events).encode()


MSG_START = ("message_start", {"type": "message_start", "message": {"id": "msg_1", "type": "message", "role": "assistant", "model": "claude-sonnet-5-5", "content": [], "stop_reason": None, "stop_sequence": None, "usage": {"input_tokens": 10, "output_tokens": 1}}})


def text_block(i: int, *chunks: str):
    yield "content_block_start", {"type": "content_block_start", "index": i, "content_block": {"type": "text", "text": ""}}
    for c in chunks:
        yield "content_block_delta", {"type": "content_block_delta", "index": i, "delta": {"type": "text_delta", "text": c}}
    yield "content_block_stop", {"type": "content_block_stop", "index": i}


def tool_block(i: int, tid: str, name: str, args: dict):
    yield "content_block_start", {"type": "content_block_start", "index": i, "content_block": {"type": "tool_use", "id": tid, "name": name, "input": {}}}
    raw = json.dumps(args)
    yield "content_block_delta", {"type": "content_block_delta", "index": i, "delta": {"type": "input_json_delta", "partial_json": raw[:8]}}
    yield "content_block_delta", {"type": "content_block_delta", "index": i, "delta": {"type": "input_json_delta", "partial_json": raw[8:]}}
    yield "content_block_stop", {"type": "content_block_stop", "index": i}


def end(stop: str):
    yield "message_delta", {"type": "message_delta", "delta": {"stop_reason": stop, "stop_sequence": None}, "usage": {"output_tokens": 20}}
    yield "message_stop", {"type": "message_stop"}


def make_llm(events, captured: list, **settings_kw):
    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, headers={"content-type": "text/event-stream"}, content=sse(*events))

    client = anthropic.AsyncAnthropic(api_key="sk-test", http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    return AnthropicLLM(Settings(_env_file=None, anthropic_api_key="sk-test", **settings_kw), client=client)


SYSTEM = [{"type": "text", "text": "persona", "cache_control": {"type": "ephemeral"}}, {"type": "text", "text": "lang"}]
TOOLS = [{"name": "reset_scene", "description": "d", "input_schema": {"type": "object", "properties": {}}}]


async def collect(llm):
    return [e async for e in llm.stream_turn(SYSTEM, [{"role": "user", "content": "hi"}], TOOLS)]


@pytest.mark.anyio
async def test_text_and_tool_use_turn_parsed_from_real_sdk_stream():
    cap: list = []
    events = [MSG_START, *text_block(0, "Let's ", "look."), *tool_block(1, "toolu_1", "set_param", {"name": "gravity", "value": "moon"}), *end("tool_use")]
    out = await collect(make_llm(events, cap))
    assert [e.text for e in out if isinstance(e, TextDelta)] == ["Let's ", "look."]
    turn = out[-1]
    assert isinstance(turn, TurnEnd) and turn.stop_reason == "tool_use"
    assert [(t.id, t.name, t.input) for t in turn.tool_uses] == [("toolu_1", "set_param", {"name": "gravity", "value": "moon"})]
    assert [b.type for b in turn.content] == ["text", "tool_use"]  # returned unchanged for the next request


@pytest.mark.anyio
async def test_request_shape_matches_what_current_models_accept():
    cap: list = []
    await collect(make_llm([MSG_START, *text_block(0, "ok"), *end("end_turn")], cap, anthropic_model="claude-sonnet-5-5", anthropic_effort="low"))
    req = cap[0]
    body = json.loads(req.content)
    assert req.url.path == "/v1/messages" and "beta" not in req.url.query.decode()
    assert body["model"] == "claude-sonnet-5-5" and body["stream"] is True
    assert body["output_config"] == {"effort": "low"} and body["max_tokens"] == 700
    assert body["system"][0]["cache_control"] == {"type": "ephemeral"} and body["system"][1]["text"] == "lang"
    assert body["tools"][0]["name"] == "reset_scene"
    # Parameters that current models reject or that we deliberately don't send:
    for forbidden in ("tool_choice", "temperature", "top_p", "top_k", "thinking"):
        assert forbidden not in body
    # the key is sent as a header (never in the body), and only server-side
    assert "sk-test" in " ".join(req.headers.values()) and b"sk-test" not in req.content


@pytest.mark.anyio
async def test_model_comes_from_config():
    cap: list = []
    await collect(make_llm([MSG_START, *text_block(0, "ok"), *end("end_turn")], cap, anthropic_model="claude-haiku-5-5"))
    assert json.loads(cap[0].content)["model"] == "claude-haiku-5-5"


@pytest.mark.anyio
async def test_refusal_stop_reason_is_surfaced():
    out = await collect(make_llm([MSG_START, *end("refusal")], []))
    assert isinstance(out[-1], TurnEnd) and out[-1].stop_reason == "refusal"


@pytest.mark.anyio
async def test_fallbacks_flag_uses_beta_endpoint_with_default_mode():
    cap: list = []
    await collect(make_llm([MSG_START, *text_block(0, "ok"), *end("end_turn")], cap, anthropic_fallbacks=True))
    req = cap[0]
    assert "server-side-fallback-2026-07-01" in req.headers["anthropic-beta"]
    assert json.loads(req.content)["fallbacks"] == "default"


def test_error_classification_is_safe():
    req = httpx.Request("POST", "https://x")
    assert classify_error(anthropic.RateLimitError("m", response=httpx.Response(429, request=req), body=None))[0] == "busy"
    assert classify_error(anthropic.InternalServerError("m", response=httpx.Response(529, request=req), body=None))[0] == "llm_unavailable"
    assert classify_error(anthropic.APIConnectionError(request=req))[0] == "network"
    assert classify_error(ValueError("x"))[0] == "llm_error"


@pytest.fixture
def anyio_backend():
    return "asyncio"
