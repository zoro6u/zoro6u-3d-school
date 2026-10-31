from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """All configuration comes from environment variables / .env. Nothing is hardcoded."""

    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-5-5"  # claude-haiku-5-5 is the cheaper option for public demos
    # Thinking depth. A tutor that answers in 2-4 spoken sentences needs little: "low" keeps replies snappy.
    anthropic_effort: str = "low"
    # Server-side refusal fallback (Claude API only). Off by default so a first live test has one moving part.
    anthropic_fallbacks: bool = False
    max_output_tokens: int = 700
    cors_origins: str = "http://localhost:5173"
    content_dir: Path = REPO_ROOT / "content"

    # Developer/test switch: a scripted fake LLM so the whole pipeline (SSE, tool calls, UI) runs with no key.
    mock_llm: bool = False

    # Abuse limits
    rate_limit_per_minute: int = 20
    trust_proxy: bool = False  # honour X-Forwarded-For (set true behind Render/Fly/etc.)
    max_history_messages: int = 12
    max_message_chars: int = 800
    max_scene_chars: int = 4000
    max_tool_rounds: int = 3

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def llm_provider(self) -> str | None:
        if self.mock_llm:
            return "mock"
        return "anthropic" if self.anthropic_api_key else None

    @property
    def llm_enabled(self) -> bool:
        return self.llm_provider is not None


@lru_cache
def get_settings() -> Settings:
    return Settings()
