# 3D School

Interactive Biology, Physics and Chemistry labs in 3D, with AI "teacher" characters. English + Arabic (RTL).

> **Status:** Phase 4 of 7 — landing hallway and the Physics, Biology and Chemistry labs are done. Next: AI teacher (Phase 5).

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

## Chemistry lab (Phase 4) — data-driven

- A reaction is a folder of data files, nothing else:
  `content/lessons/chemistry-water-synthesis/reactions/<id>/{reaction.json, en.json, ar.json}`.
  `reaction.json` holds species, the equation, atoms, and **stage keyframes** (atom positions + bonds per stage);
  `en.json`/`ar.json` hold the captions. Adding HCl + NaOH → NaCl + H₂O needed **no code changes** — it ships as the second reaction
  and appears in the UI automatically.
- One generic engine plays any reaction: atoms interpolate between keyframes, bonds fade out as they break and in as they form.
  Controls: play/pause, **step forward/back** (pauses at each stage), scrub timeline, stage chips, 0.5×–2× speed.
- Exothermic glow (soft additive sprite, light, and sparks) driven by a per-stage `glow` value; ball-and-stick with CPK colours
  from `content/elements.json`; ionic bonds drawn as thin translucent sticks.
- **Balancing view:** change the coefficients and watch atom counts on both sides (✓/✗ per element); it flags
  balanced-but-not-simplest answers (e.g. 4H₂ + 2O₂ → 4H₂O).
- **Energy:** the energy diagram and bond-bookkeeping panel are *derived* from the bonds in the data and tabulated mean bond
  energies (2·436 + 498 = 1370 kJ absorbed, 4·463 = 1852 kJ released, net −482 kJ vs the measured −483.6 kJ).
- **Data validation:** every reaction file is validated by the test suite — balanced equation, same atoms in every stage,
  first/last stage form exactly the reactant/product molecules, no overlapping atoms, plausible bond lengths, and en+ar text for every stage.
  A broken data file fails `pnpm test` with a readable message.
- Honest simplifications, shown in the UI: the real H₂ + O₂ reaction is a radical chain mechanism (H•, O•, OH•) and needs a
  spark; in solution NaOH and NaCl are ions, not molecules.
