# Feature notes

Detailed notes on each part of the app (moved out of the README). Phases refer to the build order.

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

## AI teacher (Phase 5)

One teacher per lab — **Dr. Nour** (biology), **Prof. Karim** (physics), **Ms. Layla** (chemistry) — each with a personality and
teaching style (`content/teachers/*.json`), a low-poly procedural 3D character with idle animation, and a mouth driven by the voice.

- **Backend (FastAPI):** `POST /api/chat` streams Server-Sent Events (`text`, `action`, `done`, `error`). All LLM calls go through the
  server, so the API key never reaches the browser. The model name is config (`ANTHROPIC_MODEL`, default `claude-sonnet-5-5`;
  **`claude-haiku-5-5` is the cheaper option for public demos**).
- **Scene-aware:** every request carries the live scene as JSON (pendulum length/angle/energies/periods, selected organelle,
  reaction step…), wrapped as untrusted data in the prompt.
- **Scene control through tool use:** `set_param`, `focus_object`, `play_reaction_step`, `reset_scene`. Which tools and which
  ranges are allowed per lesson is data (`teacherTools` in each `lesson.json`; ranges point at the same data the sliders use).
  Every call is validated **twice** — on the server before it is accepted, and in the browser before it touches the scene — by two
  implementations that are tested against one shared set of 50 cases (`content/tests/tool-cases.json`). Invalid calls are returned
  to the model as errors so it can correct itself; they never reach the scene.
- **Guardrails:** curated `facts.md` per lesson injected as ground truth; science-only, age-appropriate, "don't invent facts",
  prompt-injection resistant; input caps (message length, history, scene size) and a per-IP rate limit.
- **Socratic mode:** the "Ask me" toggle makes the teacher guide with questions instead of lecturing.
- **Short spoken replies** (2–4 sentences), streamed, spoken sentence-by-sentence as they arrive; captions are always shown.
- **Voice behind an interface** (`SpeechProvider`): Web Speech API by default; swap in a paid TTS with `setSpeechProvider()`.
  Optional voice input via `SpeechRecognition` (Chromium/Safari only).
- **Offline / no key:** `/api/chat` answers 503 `llm_unavailable`; the panel shows an offline banner and the labs keep working.
  The scripted guided tour (below) is the fallback.

### Honest limits
- **Lip-sync is simulated, not amplitude-based.** The Web Speech API plays audio straight to the OS, so there is no waveform to
  read. The mouth follows a speech-rate oscillation plus word-boundary events (Chrome desktop fires them; Android often doesn't).
  A TTS provider that returns audio can expose an `AnalyserNode` for true amplitude sync without touching the avatar.
- **Arabic voices vary by browser/OS.** Chrome on Android usually has one; many desktop browsers don't. When none exists the UI says
  so and the teacher is captions-only.
- **The live Claude call is untested here** (no API key in the build environment). It is covered by tests that run the real SDK
  against replayed API events, and by a scripted mock LLM (`MOCK_LLM=true`, dev/CI only). Follow
  [`docs/live-verification.md`](docs/live-verification.md) to confirm with your key.

### Dev without a key
```bash
cd api && MOCK_LLM=true uv run uvicorn app.main:app --reload     # scripted teacher
cd web && pnpm dev
```

## Guided tours, quizzes and progress (Phase 6)

**Offline guided tour — works with no API key and no network.** Each lab has a narrated walkthrough (`tour.json` + `tour.en.json`
+ `tour.ar.json` next to the lesson). A step performs scene actions, shows the caption, and speaks it with the teacher's voice;
the tour moves on when the voice finishes (or after a reading-time floor if voice is off or unavailable). Controls: pause/resume,
next/back (stepping while paused shows each step without auto-advancing), end tour. Physics: reset → 10° swing → longer pendulum →
heavier bob → Moon → 90° swing → damping → spring → 4× mass. Biology follows a protein from nucleus → ribosome → rough ER →
Golgi, then the rest of the cell, ending in a cutaway. Chemistry steps through all six stages, balances the equation, and shows
the acid–base reaction.
- Tours use the **same actions and validator** as the AI teacher (`set_param`, `focus_object`, …), so a tour can never do
  something the teacher couldn't — and a test validates every tour action against the lesson manifest on both the TypeScript and
  Python side.
- **The numbers a tour states are tested against the simulation** (e.g. "2.84 s", "7.0 s", "2.37 s", "1.40 s", "2.81 s",
  and the 1370 / 1852 / −482 / −483.6 kJ bookkeeping).

**Quizzes.** Three questions per lab (`quiz.json` + `quiz.en/ar.json`), four choices each, instant feedback with an explanation after
every answer, deterministic scoring (pass mark 2/3), and a result screen with a teacher's scripted feedback line. When the AI
teacher is online, a missed question offers "Ask … to explain", which sends the question, your answer and the right answer to
the teacher. Quiz answers are tested against the real physics/chemistry code. The dialog uses the native `<dialog>` (focus trap,
Esc to close) and radio inputs, so it is fully keyboard-accessible.

**Progress** is saved in `localStorage` (`3dschool.progress`): tour done, best quiz score, attempts; a lab is **completed** when its
quiz is passed. Landing cards and lab headers show status, with an overall bar and a two-step "reset progress". Stored data is
**sanitised on load**, so hand-edited or corrupt values can't break the app.

### Adding or editing content
Everything above is data: add `tour*.json` / `quiz*.json` to a lesson folder and the tests validate it (valid actions, text in both
languages, four distinct choices, answers in range, 3 questions). Arabic text lives in the `*.ar.json` files and `web/src/i18n/ar.json`.
