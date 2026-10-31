/**
 * Fixed-timestep accumulator: the physics always advances in identical dt steps,
 * so results don't depend on the display's frame rate. A frame longer than
 * maxFrame (e.g. a backgrounded tab) is clamped to avoid a spiral of death.
 */
export class FixedStepClock {
  private acc = 0;

  constructor(
    readonly dt: number,
    readonly maxFrame = 0.1,
  ) {}

  reset(): void {
    this.acc = 0;
  }

  advance(frameDt: number, step: () => void): number {
    this.acc += Math.min(Math.max(frameDt, 0), this.maxFrame);
    let n = 0;
    while (this.acc >= this.dt) {
      step();
      this.acc -= this.dt;
      n++;
    }
    return n;
  }
}
