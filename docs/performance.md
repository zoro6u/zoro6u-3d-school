# Performance

Target: smooth on a mid-range Android phone. What was done, and, just as important, what was and wasn't measured.

## Techniques
- **Lazy loading**: each lab, the 3D hallway, the avatar and the whole three.js/R3F bundle are separate chunks, loaded on demand.
- **Capped pixel ratio** (≤1.5 on high, 1 on low) and no antialiasing in low mode.
- **Instancing**: ribosomes (~240) and lysosomes in the cell are `InstancedMesh`, one shared material per organelle.
- **Low-poly procedural geometry**; low graphics cuts triangles by 59% (biology) and 72% (chemistry).
- **No per-frame React renders**: the physics simulation and charts read from refs and draw straight to canvas; React updates readouts at ~10 Hz.
- **Fixed-timestep physics** decoupled from display refresh; frames longer than 100 ms are clamped (no spiral of death on a hiccup).
- **Adaptive quality**: starts in low graphics only on ≤2 cores / ≤2 GB devices; otherwise a frame-rate watcher drops to low
  graphics (with an "undo" notice) if fps stays under 22 for two 3-second windows. Disable with `?autoquality=off`.
- **Reduced motion** pauses idle animation, auto-rotate, camera easing and sparks.
- **Offline app shell** via service worker (precached after first visit).
- **Perf HUD**: add `?perf=1` to any URL for live fps, draw calls, triangles and DPR. Use it on a real phone.

## Measurements (`pnpm audit:perf`)
JS cost per frame was measured with WebGL disabled and **4× CPU throttling** (approximating a mid-range phone's CPU) over 10 s per lab:

| Lab (JS only: simulation + charts + React) | median frame | p95 | worst | long tasks >50 ms | JS heap |
|---|---|---|---|---|---|
| Physics (RK4 + 2 live charts) | 16.7 ms | 16.7 ms | 33.4 ms (1 frame) | 0 | 10 MB |
| Chemistry (tour running) | 16.7 ms | 16.8 ms | 16.8 ms | 0 | 10 MB |
| Biology (UI only; its cost is GPU-side) | 16.7 ms | 16.7 ms | 16.8 ms | 0 | 10 MB |

GPU-independent render workload (from three.js `renderer.info`):

| Scene | draw calls | triangles (high) | triangles (low) |
|---|---|---|---|
| Landing hallway | 26 | 3,042 | 3,042 |
| Physics | 5 | 944 | 944 |
| Biology | 55 | 44,772 | 18,554 |
| Chemistry | 11 | 6,208 | 1,752 |

Download size (gzip): landing page **375 KB** (app 138 KB + three.js/R3F 235 KB + hallway 2 KB); each lab adds 2–12 KB plus a
shared 18 KB (teacher, quiz, tours); the avatar is 1.4 KB.

## What this does NOT prove
- **No real GPU or phone was available.** The sandbox browser renders WebGL in software, so GPU frame rates are unmeasurable here;
  the numbers above show the JS side holds 60 fps under CPU throttling and that the scene workloads are small (≤55 draw calls,
  ≤45k triangles is comfortable for mid-range mobile GPUs), not that every phone hits 60 fps.
- **Next step for you:** open the deployed site on your phone with `?perf=1`, try each lab in high and low graphics, and note the fps.
  If it dips, the adaptive watcher will switch to low by itself, and the numbers in the HUD tell you which lab to tune.

## Accessibility & responsive audit (`pnpm audit:ui`)
axe-core (WCAG 2.1 A/AA) on the landing page and all three labs, in English and Arabic, also with the teacher panel, tour card and
quiz dialog open: **0 violations**. Horizontal overflow checked at 360/390/768/1280 px, both fresh loads and live resizes: **none**.
The audit found and fixed two real issues during development (a grid that couldn't shrink after rotating a phone, and stage
buttons whose accessible name omitted their visible text).
