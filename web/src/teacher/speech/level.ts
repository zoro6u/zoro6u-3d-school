/**
 * Mouth openness for lip-sync when real audio levels are unavailable.
 *
 * The Web Speech API plays audio straight to the OS, so there is no waveform to measure. Instead we:
 *  - run a syllable-rate oscillation (~4 Hz) while the voice is speaking, and
 *  - add a bump whenever the browser fires a word `boundary` event (Chrome desktop does; Android often doesn't).
 * It looks like speech, but it is not true amplitude sync. A provider that exposes an AnalyserNode gets real levels.
 */
export function mouthLevel(speaking: boolean, nowMs: number, lastBoundaryMs: number): number {
  if (!speaking) return 0;
  const t = nowMs / 1000;
  const syllable = 0.5 + 0.5 * Math.sin(t * 25); // ~4 Hz
  const variation = 0.6 + 0.4 * Math.sin(t * 7.3 + 1.2); // slower amplitude drift so it isn't a pure sine
  const base = 0.15 + 0.55 * syllable * variation;
  const sinceBoundary = nowMs - lastBoundaryMs;
  const bump = sinceBoundary >= 0 && sinceBoundary < 160 ? 0.35 * (1 - sinceBoundary / 160) : 0;
  return Math.min(1, Math.max(0, base + bump));
}

/** 0 = eyes open, 1 = fully closed. A quick blink roughly every 3.7 s. */
export function blinkAmount(tSeconds: number): number {
  const period = 3.7;
  const phase = tSeconds % period;
  const dur = 0.14;
  if (phase > dur) return 0;
  return Math.sin((phase / dur) * Math.PI);
}
