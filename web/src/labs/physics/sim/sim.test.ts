import { describe, expect, it } from 'vitest';
import { FixedStepClock } from './clock';
import { DT, OscillatorEngine, theoryFor, type PendulumSetup, type SpringSetup } from './engine';
import { History } from './history';
import { PeriodMeter } from './periodMeter';
import { rk4Step } from './rk4';
import { agm, dampedPeriod, pendulumPeriodExact, pendulumPeriodSmall, smallAngleError, springPeriod } from './theory';

const deg = (d: number) => (d * Math.PI) / 180;
const pend = (o: Partial<PendulumSetup> = {}): PendulumSetup => ({
  mode: 'pendulum', length: 1, mass: 1, g: 9.81, damping: 0, angleDeg: 30, ...o,
});
const spring = (o: Partial<SpringSetup> = {}): SpringSetup => ({
  mode: 'spring', k: 20, mass: 1, damping: 0, displacement: 0.3, ...o,
});

/** Run the engine for `seconds` of sim time. */
function run(e: OscillatorEngine, seconds: number) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) e.step();
}

describe('rk4', () => {
  it('matches the analytic solution of x″ = −x', () => {
    const s = { x: 1, v: 0 };
    const n = 5000; // t = 10 s at dt = 0.002
    for (let i = 0; i < n; i++) rk4Step((x) => -x, s, DT);
    expect(s.x).toBeCloseTo(Math.cos(n * DT), 9);
    expect(s.v).toBeCloseTo(-Math.sin(n * DT), 9);
  });
});

describe('theory', () => {
  it('AGM matches a known value (Gauss constant 1/AGM(1,√2) ≈ 0.8346268)', () => {
    expect(1 / agm(1, Math.SQRT2)).toBeCloseTo(0.8346268416740731, 12);
  });
  it('small-angle pendulum period: 1 m on Earth ≈ 2.006 s', () => {
    expect(pendulumPeriodSmall({ length: 1, g: 9.81 })).toBeCloseTo(2.0064, 3);
  });
  it('exact period → small-angle period as amplitude → 0', () => {
    const p = { length: 1, g: 9.81 };
    expect(pendulumPeriodExact(p, 1e-4) / pendulumPeriodSmall(p)).toBeCloseTo(1, 8);
  });
  it('exact period is ~18% longer at 90° and ~7% longer at 60° (textbook values)', () => {
    expect(smallAngleError(deg(90))).toBeCloseTo(0.1803, 3);
    expect(smallAngleError(deg(60))).toBeCloseTo(0.0732, 3);
  });
  it('small-angle error is under 0.5% below 15°', () => {
    expect(smallAngleError(deg(15))).toBeLessThan(0.005);
  });
  it('spring period T = 2π√(m/k)', () => {
    expect(springPeriod({ mass: 1, k: 20 })).toBeCloseTo(2 * Math.PI * Math.sqrt(1 / 20), 12);
  });
  it('damped period lengthens, and over-damping gives NaN', () => {
    expect(dampedPeriod(2, 1)).toBeGreaterThan(2 * Math.PI / 2);
    expect(dampedPeriod(1, 2.5)).toBeNaN();
  });
});

describe('pendulum simulation', () => {
  it('measured period matches the exact large-angle period (60°, 90°, 150°) within 0.05%', () => {
    for (const angleDeg of [60, 90, 150]) {
      const setup = pend({ angleDeg });
      const e = new OscillatorEngine(setup);
      run(e, 30);
      const snap = e.snapshot();
      expect(snap.measuredMean).not.toBeNull();
      expect(Math.abs(snap.measuredMean! / snap.theory.exact! - 1)).toBeLessThan(5e-4);
    }
  });
  it('at 90° the measured period clearly differs from the small-angle formula', () => {
    const e = new OscillatorEngine(pend({ angleDeg: 90 }));
    run(e, 30);
    const s = e.snapshot();
    expect(s.measuredMean! / s.theory.small).toBeGreaterThan(1.17);
  });
  it('small-angle formula holds at 5°', () => {
    const e = new OscillatorEngine(pend({ angleDeg: 5 }));
    run(e, 20);
    const s = e.snapshot();
    expect(Math.abs(s.measuredMean! / s.theory.small - 1)).toBeLessThan(0.002);
  });
  it('conserves total energy without damping (drift < 1e-7 relative over 60 s)', () => {
    const e = new OscillatorEngine(pend({ angleDeg: 120 }));
    const e0 = e.snapshot().total;
    run(e, 60);
    expect(Math.abs(e.snapshot().total / e0 - 1)).toBeLessThan(1e-7);
  });
  it('initial energy is m·g·L·(1 − cos θ0), all potential', () => {
    const e = new OscillatorEngine(pend({ angleDeg: 60, mass: 2, length: 1.5 }));
    const s = e.snapshot();
    expect(s.ke).toBe(0);
    expect(s.pe).toBeCloseTo(2 * 9.81 * 1.5 * (1 - Math.cos(deg(60))), 10);
  });
  it('mass does not change the period', () => {
    const a = new OscillatorEngine(pend({ mass: 0.2 }));
    const b = new OscillatorEngine(pend({ mass: 4.5 }));
    run(a, 20);
    run(b, 20);
    expect(a.snapshot().measuredMean!).toBeCloseTo(b.snapshot().measuredMean!, 6);
  });
  it('Moon period is √(g_earth / g_moon) ≈ 2.46× longer', () => {
    const earth = theoryFor(pend({ g: 9.81 })).small;
    const moon = theoryFor(pend({ g: 1.62 })).small;
    expect(moon / earth).toBeCloseTo(Math.sqrt(9.81 / 1.62), 10);
    const e = new OscillatorEngine(pend({ g: 1.62, angleDeg: 5 }));
    run(e, 40);
    expect(e.snapshot().measuredMean! / earth).toBeCloseTo(2.46, 1);
  });
  it('damping dissipates energy monotonically', () => {
    const e = new OscillatorEngine(pend({ damping: 0.1 }));
    let prev = e.snapshot().total;
    for (let i = 0; i < 20; i++) {
      run(e, 1);
      const t = e.snapshot().total;
      expect(t).toBeLessThan(prev);
      prev = t;
    }
  });
});

describe('spring simulation', () => {
  it('measured period matches 2π√(m/k), independent of amplitude', () => {
    for (const displacement of [0.05, 0.5]) {
      const e = new OscillatorEngine(spring({ displacement }));
      run(e, 20);
      const s = e.snapshot();
      expect(Math.abs(s.measuredMean! / s.theory.small - 1)).toBeLessThan(1e-4);
    }
  });
  it('conserves energy (½kA²) without damping', () => {
    const e = new OscillatorEngine(spring());
    const e0 = 0.5 * 20 * 0.3 * 0.3;
    expect(e.snapshot().total).toBeCloseTo(e0, 12);
    run(e, 60);
    expect(Math.abs(e.snapshot().total / e0 - 1)).toBeLessThan(1e-8);
  });
  it('underdamped amplitude decays as exp(−c t / 2m)', () => {
    const e = new OscillatorEngine(spring({ damping: 0.5, mass: 1, k: 20, displacement: 0.4 }));
    run(e, 10);
    // after exactly some number of half-cycles, find the envelope via energy: E ∝ exp(−c t / m) (cycle-averaged)
    const s0 = 0.5 * 20 * 0.4 * 0.4;
    const ratio = e.snapshot().total / s0;
    expect(ratio).toBeGreaterThan(Math.exp(-0.5 * 10) * 0.6);
    expect(ratio).toBeLessThan(Math.exp(-0.5 * 10) * 1.6);
  });
  it('measured damped period matches the damped theory', () => {
    const e = new OscillatorEngine(spring({ damping: 1.5, displacement: 0.5 }));
    run(e, 20);
    const s = e.snapshot();
    expect(s.theory.damped).not.toBeNull();
    expect(Math.abs(s.measuredMean! / s.theory.damped! - 1)).toBeLessThan(1e-3);
  });
});

describe('engine control', () => {
  it('changing damping keeps the motion; changing length restarts it', () => {
    const e = new OscillatorEngine(pend());
    run(e, 3);
    const t = e.time;
    e.configure(pend({ damping: 0.2 }));
    expect(e.time).toBe(t);
    e.configure(pend({ damping: 0.2, length: 2 }));
    expect(e.time).toBe(0);
    expect(e.state.x).toBeCloseTo(deg(30), 12);
  });
  it('switching mode restarts', () => {
    const e = new OscillatorEngine(pend());
    run(e, 1);
    e.configure(spring());
    expect(e.time).toBe(0);
    expect(e.state.x).toBe(0.3);
  });
  it('pausing freezes time', () => {
    const e = new OscillatorEngine(pend());
    e.setRunning(false);
    e.update(1);
    expect(e.time).toBe(0);
  });
});

describe('fixed-step clock', () => {
  it('takes the same number of steps regardless of frame pacing', () => {
    const count = (frames: number[]) => {
      const c = new FixedStepClock(0.002);
      let n = 0;
      for (const f of frames) n += c.advance(f, () => {});
      return n;
    };
    const smooth = count(Array(60).fill(1 / 60));
    const uneven = count([...Array(30).fill(1 / 30)]);
    expect(Math.abs(smooth - 500)).toBeLessThanOrEqual(1);
    expect(Math.abs(uneven - 500)).toBeLessThanOrEqual(1);
  });
  it('clamps very long frames (backgrounded tab)', () => {
    const c = new FixedStepClock(0.002, 0.1);
    const n = c.advance(30, () => {}); // 30 s clamped to 0.1 s ≈ 50 steps (±1 float rounding)
    expect(n).toBeGreaterThanOrEqual(49);
    expect(n).toBeLessThanOrEqual(50);
  });
});

describe('PeriodMeter', () => {
  it('interpolates crossings of a known sine to ~1e-6', () => {
    const m = new PeriodMeter();
    const T = 1.2345;
    for (let t = 0; t < 20; t += 0.01) m.feed(t, Math.sin((2 * Math.PI * t) / T));
    expect(m.mean!).toBeCloseTo(T, 5);
    expect(m.count).toBeGreaterThan(10);
  });
  it('reports nothing before two crossings', () => {
    const m = new PeriodMeter();
    m.feed(0, 1);
    m.feed(1, 0.5);
    expect(m.mean).toBeNull();
    expect(m.last).toBeNull();
  });
});

describe('History', () => {
  it('keeps the newest `capacity` samples in order', () => {
    const h = new History(3, 1);
    for (let i = 0; i < 5; i++) h.push(i, [i * 10]);
    expect(h.length).toBe(3);
    expect([0, 1, 2].map((i) => h.time(i))).toEqual([2, 3, 4]);
    expect([0, 1, 2].map((i) => h.value(0, i))).toEqual([20, 30, 40]);
  });
});
