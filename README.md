# 3D School

Interactive Biology, Physics and Chemistry labs in 3D, with AI "teacher" characters. English + Arabic (RTL).

> **Status:** Phase 1 of 7 — scaffold, routing, i18n/RTL, 3D landing hallway. Labs are placeholders.

## Run it

```bash
# frontend
cd web && pnpm install && pnpm dev          # http://localhost:5173
# backend (optional until Phase 5)
cd api && uv sync && uv run uvicorn app.main:app --reload   # http://localhost:8000/api/health
```

Copy `.env.example` to `.env` for backend config. With no API key the app still works (scripted tours arrive in Phase 6).

## Tests

```bash
cd web && pnpm test && pnpm typecheck
cd api && uv run pytest && uv run ruff check .
```

## Layout

- `web/` React + Vite + TypeScript (strict), React Three Fiber, Zustand, Tailwind, i18next
- `api/` FastAPI; will proxy all LLM calls so keys never reach the browser
- `content/lessons/<id>/` lesson data (metadata now; facts, tours, quizzes in later phases)

All UI strings live in `web/src/i18n/{en,ar}.json`; a test enforces that both files have identical keys.

## Demo GIF

_Placeholder — to be recorded on a phone._
