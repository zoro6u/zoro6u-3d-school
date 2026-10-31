# 3D School

Interactive Biology, Physics and Chemistry labs in 3D, with AI "teacher" characters. English + Arabic (RTL).

> **Status:** Phase 2 of 7 — landing hallway + Physics lab (pendulum & mass–spring) done. Biology and Chemistry labs are placeholders.

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

## Physics lab (Phase 2)

- Real numerical simulation: RK4 at a fixed 2 ms timestep (`web/src/labs/physics/sim/`, pure TypeScript, no React/Three).
- The pendulum uses the **full nonlinear equation** `θ'' = −(g/L)·sin θ − c/(mL²)·θ'` — no small-angle shortcut.
- The measured period comes from interpolated zero-crossings of the live simulation and is shown beside the theory:
  small-angle `T = 2π√(L/g)`, the exact large-angle period (via the arithmetic–geometric mean), and the damped period.
  At 90° the small-angle formula is ~18% off; the lab explains why.
- Slider ranges, defaults and gravity presets (Earth 9.81, Moon 1.62, Mars 3.71 m/s²) live in
  `content/lessons/physics-oscillations/lesson.json`.
- 28 unit tests check the maths against textbook values, energy conservation, mass-independence of the period, etc.
