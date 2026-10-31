/**
 * Measures the oscillation period from upward zero-crossings of x(t).
 * The crossing instant is found by linear interpolation between steps, so the
 * error is O(dt²) rather than O(dt).
 */
export class PeriodMeter {
  private prevT = 0;
  private prevX = 0;
  private hasPrev = false;
  private crossings: number[] = [];

  reset(): void {
    this.hasPrev = false;
    this.crossings = [];
  }

  feed(t: number, x: number): void {
    if (this.hasPrev && this.prevX < 0 && x >= 0) {
      const frac = -this.prevX / (x - this.prevX);
      this.crossings.push(this.prevT + frac * (t - this.prevT));
    }
    this.prevT = t;
    this.prevX = x;
    this.hasPrev = true;
  }

  /** Number of complete periods measured (crossings − 1). */
  get count(): number {
    return Math.max(0, this.crossings.length - 1);
  }

  get last(): number | null {
    const n = this.crossings.length;
    return n >= 2 ? this.crossings[n - 1]! - this.crossings[n - 2]! : null;
  }

  /** Mean over all measured periods, or null if none yet. */
  get mean(): number | null {
    const n = this.crossings.length;
    return n >= 2 ? (this.crossings[n - 1]! - this.crossings[0]!) / (n - 1) : null;
  }
}
