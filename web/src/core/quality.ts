/**
 * Adaptive graphics quality. A mid-range phone should run the labs smoothly, but we can't know the GPU in advance,
 * so we (1) start low only on clearly weak devices, and (2) watch the real frame rate and drop to "low graphics"
 * if it stays poor. All pure logic, so it is unit-tested without a GPU.
 */

export interface FpsOptions {
  /** Length of one measurement window. */
  windowSec: number;
  /** Ignore everything before this (shader compilation and first-frame hitches). */
  warmupSec: number;
  /** Average fps below this counts as a bad window. */
  minFps: number;
  /** Consecutive bad windows needed before degrading. */
  strikes: number;
}

const DEFAULTS: FpsOptions = { windowSec: 3, warmupSec: 3, minFps: 22, strikes: 2 };

export class FpsWatcher {
  private readonly o: FpsOptions;
  private elapsed = 0;
  private winTime = 0;
  private winFrames = 0;
  private bad = 0;
  private fired = false;
  /** fps of the most recent completed window (0 until the first one). */
  lastFps = 0;

  constructor(options: Partial<FpsOptions> = {}) {
    this.o = { ...DEFAULTS, ...options };
  }

  /** Feed one frame's duration in seconds. Returns true exactly once, when quality should be reduced. */
  push(dt: number): boolean {
    if (this.fired || !(dt > 0)) return false;
    if (dt > 0.5) {
      // tab was in the background or the page was suspended: not a rendering-speed signal
      this.winTime = 0;
      this.winFrames = 0;
      return false;
    }
    this.elapsed += dt;
    if (this.elapsed < this.o.warmupSec) return false;
    this.winTime += dt;
    this.winFrames++;
    if (this.winTime < this.o.windowSec) return false;
    this.lastFps = this.winFrames / this.winTime;
    this.winTime = 0;
    this.winFrames = 0;
    this.bad = this.lastFps < this.o.minFps ? this.bad + 1 : 0;
    if (this.bad >= this.o.strikes) {
      this.fired = true;
      return true;
    }
    return false;
  }
}

interface NavLike {
  hardwareConcurrency?: number;
  deviceMemory?: number;
}

/** Start in low graphics only on clearly weak hardware (≤2 cores or ≤2 GB). Everything else starts high and adapts. */
export function defaultLowGraphics(nav: NavLike = typeof navigator === 'undefined' ? {} : (navigator as NavLike)): boolean {
  const cores = nav.hardwareConcurrency;
  const mem = nav.deviceMemory;
  return (typeof cores === 'number' && cores > 0 && cores <= 2) || (typeof mem === 'number' && mem > 0 && mem <= 2);
}
