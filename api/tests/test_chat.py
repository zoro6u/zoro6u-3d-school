import anthropic
import httpx

from tests.conftest import FakeLLM, body, parse_sse, text_turn, tool_turn


def stream(client, payload):
    r = client.post("/api/chat", json=payload)
    return r, parse_sse(r.text) if r.status_code == 200 else []


def test_streams_text_then_done(make_client):
    c = make_client(FakeLLM([text_turn("Hello there. Nice swing!")]))
    r, ev = stream(c, body("hi"))
    assert r.headers["content-type"].startswith("text/event-stream")
    assert [e for e, _ in ev] == ["text", "done"]
    assert ev[0][1]["text"] == "Hello there. Nice swing!"


def test_valid_tool_call_emits_action_and_feeds_result_back(make_client):
    llm = FakeLLM([tool_turn("set_param", {"name": "gravity", "value": "moon"}, "Let's try the Moon."), text_turn("See how slow it is?")])
    _, ev = stream(make_client(llm), body("show me the moon"))
    kinds = [e for e, _ in ev]
    assert kinds == ["text", "action", "text", "text", "done"]  # the extra text is the separator between rounds
    assert ev[1][1] == {"tool": "set_param", "name": "gravity", "value": "moon"}
    second = llm.calls[1]["messages"]
    assert second[-2]["role"] == "assistant"
    result = second[-1]["content"][0]
    assert result["type"] == "tool_result" and result["tool_use_id"] == "t1" and "is_error" not in result


def test_text_from_separate_tool_rounds_is_not_glued_together(make_client):
    llm = FakeLLM([tool_turn("reset_scene", {}, "Resetting."), text_turn("All clear.")])
    _, ev = stream(make_client(llm), body("reset"))
    assert "".join(d["text"] for e, d in ev if e == "text") == "Resetting. All clear."


def test_invalid_tool_call_never_becomes_an_action_and_error_goes_back_to_the_model(make_client):
    llm = FakeLLM([tool_turn("set_param", {"name": "pendulum_length", "value": 99}), text_turn("That's out of range, so let me explain instead.")])
    _, ev = stream(make_client(llm), body("make it huge"))
    assert "action" not in [e for e, _ in ev]
    err = llm.calls[1]["messages"][-1]["content"][0]
    assert err["is_error"] is True and "between 0.2 and 2.5" in err["content"]


def test_tool_not_in_lesson_manifest_is_rejected(make_client):
    llm = FakeLLM([tool_turn("focus_object", {"id": "nucleus"}), text_turn("ok")])
    _, ev = stream(make_client(llm), body("x"))
    assert "action" not in [e for e, _ in ev]


def test_multiple_tool_calls_in_one_turn_each_validated(make_client):
    from app.llm.types import ToolUse, TurnEnd

    turn = [TurnEnd("tool_use", [], [ToolUse("a", "set_param", {"name": "gravity", "value": "mars"}), ToolUse("b", "set_param", {"name": "gravity", "value": "pluto"})])]
    llm = FakeLLM([turn, text_turn("done")])
    _, ev = stream(make_client(llm), body("x"))
    assert [e for e, _ in ev if e == "action"] == ["action"]
    results = llm.calls[1]["messages"][-1]["content"]
    assert [r.get("is_error", False) for r in results] == [False, True]


def test_runaway_tool_loop_is_capped(make_client):
    llm = FakeLLM([tool_turn("reset_scene", {})])  # asks for a tool every single turn
    _, ev = stream(make_client(llm, max_tool_rounds=3), body("x"))
    assert len(llm.calls) == 3
    assert ev[-1][0] == "error" and ev[-1][1]["code"] == "too_many_tool_rounds"


def test_refusal_becomes_a_friendly_error(make_client):
    from app.llm.types import TurnEnd

    _, ev = stream(make_client(FakeLLM([[TurnEnd("refusal", [])]])), body("x"))
    assert ev[-1][0] == "error" and ev[-1][1]["code"] == "refusal"


def test_truncated_tool_call_is_not_run(make_client):
    from app.llm.types import ToolUse, TurnEnd

    turn = [TurnEnd("max_tokens", [], [ToolUse("a", "reset_scene", {})])]
    _, ev = stream(make_client(FakeLLM([turn])), body("x"))
    assert [e for e, _ in ev] == ["error"] and ev[0][1]["code"] == "truncated"


def test_upstream_errors_are_classified_and_never_leak_details(make_client):
    req = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    auth = anthropic.AuthenticationError("invalid x-api-key sk-ant-SECRET", response=httpx.Response(401, request=req), body=None)
    _, ev = stream(make_client(FakeLLM([auth])), body("x"))
    assert ev[-1][1]["code"] == "llm_auth" and "SECRET" not in str(ev)
    rate = anthropic.RateLimitError("slow down", response=httpx.Response(429, request=req), body=None)
    _, ev = stream(make_client(FakeLLM([rate])), body("x"))
    assert ev[-1][1]["code"] == "busy"
    _, ev = stream(make_client(FakeLLM([RuntimeError("boom: secret internals")])), body("x"))
    assert ev[-1][1]["code"] == "llm_error" and "secret" not in str(ev)


def test_no_llm_returns_503_so_the_frontend_can_fall_back_to_the_tour(make_client):
    r = make_client(None).post("/api/chat", json=body("hi"))
    assert r.status_code == 503 and r.json()["detail"]["code"] == "llm_unavailable"


def test_unknown_lesson_404(make_client):
    r = make_client(FakeLLM([text_turn("x")])).post("/api/chat", json=body("hi", lesson="nope"))
    assert r.status_code == 404


def test_system_prompt_scene_state_and_tools_reach_the_model(make_client):
    llm = FakeLLM([text_turn("ok")])
    payload = body("what do you see?", lesson="biology-animal-cell", lang="ar", mode="socratic", scene_state={"selected_organelle": "nucleus"})
    stream(make_client(llm), payload)
    call = llm.calls[0]
    assert "Dr. Nour" in call["system"][0]["text"] and "<facts>" in call["system"][0]["text"]
    assert "Modern Standard Arabic" in call["system"][1]["text"] and "SOCRATIC" in call["system"][1]["text"]
    assert call["messages"][-1]["content"].endswith('<scene_state>{"selected_organelle":"nucleus"}</scene_state>')
    assert {t["name"] for t in call["tools"]} == {"set_param", "focus_object", "reset_scene"}


def test_history_is_trimmed_and_must_end_with_a_user_message(make_client):
    llm = FakeLLM([text_turn("ok")])
    msgs = [{"role": "assistant", "content": "welcome"}] + [m for i in range(10) for m in ({"role": "user", "content": f"q{i}"}, {"role": "assistant", "content": f"a{i}"})] + [{"role": "user", "content": "last"}]
    c = make_client(llm, max_history_messages=5)
    r = c.post("/api/chat", json={**body("x"), "messages": msgs})
    sent = llm.calls[0]["messages"]
    assert r.status_code == 200 and len(sent) <= 5 and sent[0]["role"] == "user" and "last" in sent[-1]["content"]
    bad = c.post("/api/chat", json={**body("x"), "messages": [{"role": "user", "content": "q"}, {"role": "assistant", "content": "a"}]})
    assert bad.status_code == 422 and bad.json()["detail"]["code"] == "bad_messages"


def test_input_limits(make_client):
    c = make_client(FakeLLM([text_turn("ok")]), max_message_chars=50)
    r = c.post("/api/chat", json=body("x" * 51))
    assert r.status_code == 422 and r.json()["detail"]["code"] == "message_too_long"
    assert c.post("/api/chat", json={**body("hi"), "messages": []}).status_code == 422
    assert c.post("/api/chat", json={**body("hi"), "lang": "fr"}).status_code == 422
    assert c.post("/api/chat", json={**body("hi"), "mode": "evil"}).status_code == 422


def test_rate_limit_returns_429_with_retry_after(make_client):
    from app.ratelimit import RateLimiter
    from app.routes import chat as chat_route

    c = make_client(FakeLLM([text_turn("ok")]), rate_limit_per_minute=2)
    shared = RateLimiter()
    c.app.dependency_overrides[chat_route.get_limiter] = lambda: shared
    codes = [c.post("/api/chat", json=body("hi")).status_code for _ in range(4)]
    assert codes == [200, 200, 429, 429]
    r = c.post("/api/chat", json=body("hi"))
    assert int(r.headers["retry-after"]) >= 1 and r.json()["detail"]["code"] == "rate_limited"


def test_rate_limiter_window_slides():
    from app.ratelimit import RateLimiter

    t = [0.0]
    rl = RateLimiter(clock=lambda: t[0])
    assert rl.check("a", 2) == 0 and rl.check("a", 2) == 0 and rl.check("a", 2) > 0
    assert rl.check("b", 2) == 0  # separate client
    t[0] = 61
    assert rl.check("a", 2) == 0


def test_api_key_never_appears_in_any_response(make_client):
    c = make_client(None, anthropic_api_key="sk-ant-TOPSECRET")
    assert "TOPSECRET" not in c.get("/api/health").text
    assert "TOPSECRET" not in c.post("/api/chat", json=body("hi", lesson="nope")).text


def test_mock_llm_end_to_end(mock_client):
    _, ev = stream(mock_client, body("show me the moon"))
    kinds = [e for e, _ in ev]
    assert kinds[0] == "text" and "action" in kinds and kinds[-1] == "done"
    assert ev[kinds.index("action")][1] == {"tool": "set_param", "name": "gravity", "value": "moon"}
    text = "".join(d["text"] for e, d in ev if e == "text")
    assert "1.62" in text


def test_mock_llm_arabic_and_socratic(mock_client):
    _, ev = stream(mock_client, body("mitochondria", lesson="biology-animal-cell", lang="ar", mode="socratic"))
    text = "".join(d["text"] for e, d in ev if e == "text")
    assert "؟" in text and ("focus_object" not in text)
    assert [d for e, d in ev if e == "action"] == [{"tool": "focus_object", "id": "mitochondria"}]


def test_mock_llm_out_of_range_tool_call_is_rejected_by_the_validator(mock_client):
    _, ev = stream(mock_client, body("testbad"))
    assert "action" not in [e for e, _ in ev] and ev[-1][0] == "done"


def test_health_reports_provider(make_client):
    assert make_client(None, mock_llm=True).get("/api/health").json()["provider"] == "mock"
    assert make_client(None).get("/api/health").json()["provider"] is None
    assert make_client(None, anthropic_api_key="k").get("/api/health").json()["provider"] == "anthropic"
