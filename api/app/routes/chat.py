from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.config import Settings, get_settings
from app.content import load_lessons, load_teacher
from app.llm.anthropic_client import AnthropicLLM
from app.llm.chat import run_chat, sse
from app.llm.mock import MockLLM
from app.llm.prompt import build_system, with_scene_state
from app.llm.tools import build_tool_schemas
from app.llm.types import LLMClient
from app.ratelimit import RateLimiter, limiter

router = APIRouter()


class Msg(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=5000)


class ChatRequest(BaseModel):
    lesson_id: str = Field(max_length=80)
    lang: Literal["en", "ar"] = "en"
    mode: Literal["explain", "socratic"] = "explain"
    messages: list[Msg] = Field(min_length=1, max_length=100)
    scene_state: dict[str, Any] | None = None


_clients: dict[tuple[Any, ...], LLMClient] = {}


def get_llm(settings: Annotated[Settings, Depends(get_settings)]) -> LLMClient | None:
    if settings.mock_llm:
        return MockLLM()
    if not settings.anthropic_api_key:
        return None
    key = (settings.anthropic_api_key, settings.anthropic_model, settings.anthropic_effort, settings.anthropic_fallbacks, settings.max_output_tokens)
    if key not in _clients:
        _clients[key] = AnthropicLLM(settings)
    return _clients[key]


def get_limiter() -> RateLimiter:
    return limiter


def _client_key(request: Request, settings: Settings) -> str:
    if settings.trust_proxy:
        fwd = request.headers.get("x-forwarded-for", "")
        if fwd:
            return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _err(status: int, code: str, message: str, headers: dict[str, str] | None = None) -> HTTPException:
    return HTTPException(status, {"code": code, "message": message}, headers=headers)


@router.post("/chat")
async def chat(
    body: ChatRequest,
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    llm: Annotated[LLMClient | None, Depends(get_llm)],
    rl: Annotated[RateLimiter, Depends(get_limiter)],
) -> StreamingResponse:
    lessons = load_lessons(str(settings.content_dir))
    lesson = lessons.get(body.lesson_id)
    if lesson is None:
        raise _err(404, "unknown_lesson", "That lesson does not exist.")
    if llm is None:
        # The frontend reads this and switches to the scripted offline tour.
        raise _err(503, "llm_unavailable", "The AI teacher is not available right now.")
    wait = rl.check(_client_key(request, settings), settings.rate_limit_per_minute)
    if wait:
        raise _err(429, "rate_limited", "You're asking very quickly. Please wait a moment.", {"Retry-After": str(int(wait) + 1)})

    history = [m for m in body.messages][-settings.max_history_messages :]
    while history and history[0].role != "user":
        history.pop(0)
    if not history or history[-1].role != "user":
        raise _err(422, "bad_messages", "The last message must come from the student.")
    if any(len(m.content) > settings.max_message_chars for m in history):
        raise _err(422, "message_too_long", f"Messages can be at most {settings.max_message_chars} characters.")

    messages: list[dict[str, Any]] = [{"role": m.role, "content": m.content} for m in history]
    messages[-1]["content"] = with_scene_state(messages[-1]["content"], body.scene_state, settings.max_scene_chars)

    teacher = load_teacher(str(settings.content_dir), lesson.teacher_id)
    system = build_system(lesson, teacher, body.lang, body.mode)
    tools = build_tool_schemas(lesson.raw)

    async def stream():
        async for event, data in run_chat(llm, lesson, system, messages, tools, max_rounds=settings.max_tool_rounds):
            yield sse(event, data)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )
