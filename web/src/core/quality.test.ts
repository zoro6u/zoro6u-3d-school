import { describe, expect, it } from 'vitest';
import { defaultLowGraphics, FpsWatcher } from './quality';

/** Feed `seconds` of frames at a steady fps; returns whether degrade fired. */
function run(w: FpsWatcher, fps: number, seconds: number): boolean {
  let fired = false;
  for (let i = 0; i < fps * seconds; i++) fired = w.push(1 / fps) || fired;
  return fired;
}

describe('FpsWatcher', () => {
  it('never degrades a healthy 60 fps run', () => {
    const w = new FpsWatcher();
    expect(run(w, 60, 30)).toBe(false);
    expect(w.lastFps).toBeGreaterThan(55);
  });
  it('degrades after two consecutive slow windows (and only once)', () => {
    const w = new FpsWatcher();
    expect(run(w, 12, 3.1)).toBe(false); // warm-up is ignored
    expect(run(w, 12, 3.2)).toBe(false); // first bad window: one strike
    expect(run(w, 12, 3.2)).toBe(true); // second: degrade
    expect(run(w, 12, 30)).toBe(false); // never fires again
  });
  it('a single slow patch (a hitch) does not trigger it', () => {
    const w = new FpsWatcher();
    run(w, 60, 3.1);
    expect(run(w, 10, 3.2)).toBe(false);
    expect(run(w, 60, 30)).toBe(false); // recovered: strikes reset
  });
  it('ignores frames from a backgrounded tab', () => {
    const w = new FpsWatcher();
    run(w, 60, 3.1);
    for (let i = 0; i < 20; i++) expect(w.push(5)).toBe(false);
    expect(run(w, 60, 20)).toBe(false);
  });
  it('ignores junk input', () => {
    const w = new FpsWatcher();
    for (const dt of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect(w.push(dt)).toBe(false);
  });
  it('is configurable', () => {
    const w = new FpsWatcher({ warmupSec: 0, windowSec: 1, minFps: 40, strikes: 1 });
    expect(run(w, 30, 1.2)).toBe(true);
  });
});

describe('defaultLowGraphics', () => {
  it('starts low only on clearly weak hardware', () => {
    expect(defaultLowGraphics({ hardwareConcurrency: 2 })).toBe(true);
    expect(defaultLowGraphics({ deviceMemory: 2 })).toBe(true);
    expect(defaultLowGraphics({ hardwareConcurrency: 4, deviceMemory: 4 })).toBe(false); // a typical mid-range phone
    expect(defaultLowGraphics({ hardwareConcurrency: 8, deviceMemory: 8 })).toBe(false);
    expect(defaultLowGraphics({})).toBe(false); // unknown (Safari/Firefox) → start high, adapt
  });
});
