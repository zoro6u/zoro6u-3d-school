# 3D School

Interactive Biology, Physics and Chemistry labs in 3D, with AI "teacher" characters. English + Arabic (RTL).

> **Status:** Phase 3 of 7 — landing hallway, Physics lab and Biology lab done. Chemistry is a placeholder.

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

## Biology lab (Phase 3)

- Procedural animal cell (no external models): nucleus with chromatin + nucleolus, mitochondria with cristae, rough ER sheets
  with ribosomes on them, smooth ER tubes, Golgi stack, lysosomes, cell membrane and cytoplasm.
- Orbit / zoom / pinch; click an organelle (or pick it from the list) and the camera flies to it, it glows, and the
  info panel shows its function and a fact. Keyboard: arrows rotate, `+`/`−` zoom, `Esc` clears.
- **Cutaway** removes a wedge of the membrane and cytoplasm with GPU clipping planes (organelles stay whole).
  Raycasting ignores clipping planes, so clicks inside the removed wedge are filtered out in code (`pick.ts`, tested).
- Ribosomes (~240) and lysosomes are `InstancedMesh`; one shared material per organelle makes highlighting trivial.
  "Low graphics" halves the ribosome count and mesh segment counts.
- Layout is deterministic (seeded PRNG) and unit-tested: nothing pokes out of the membrane or overlaps another organelle.
- Organelle names/functions/facts are in `web/src/i18n/{en,ar}.json` under `biology.organelles.*`;
  colours and camera framing are in `content/lessons/biology-animal-cell/lesson.json`.
- The model is schematic, not to scale (the UI says so).
