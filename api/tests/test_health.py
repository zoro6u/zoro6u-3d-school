from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import create_app


def client_with(key: str) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: Settings(anthropic_api_key=key)
    return TestClient(app)


def test_health_without_key_reports_llm_disabled():
    r = client_with("").get("/api/health")
    assert r.status_code == 200
    assert r.json()["llm"] is False


def test_health_with_key_reports_llm_enabled_but_never_leaks_key():
    r = client_with("sk-secret").get("/api/health")
    assert r.json()["llm"] is True
    assert "sk-secret" not in r.text


def test_model_comes_from_config():
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: Settings(anthropic_model="claude-haiku-5-5")
    assert TestClient(app).get("/api/health").json()["model"] == "claude-haiku-5-5"
