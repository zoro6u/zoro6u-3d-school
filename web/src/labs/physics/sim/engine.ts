import { FixedStepClock } from './clock';
import { History } from './history';
import {
  pendulumAccel,
  pendulumEnergies,
  springAccel,
  springEnergies,
  type Energies,
} from './models';
import { PeriodMeter } from './periodMeter';
import { rk4Step, type Accel, type State } from './rk4';
import {
  dampedPeriod,
  pendulumPeriodExact,
  pendulumPeriodSmall,
  smallAngleError,
  springPeriod,
} from './theory';

export interface PendulumSetup {
  mode: 'pendulum';
  length: number;
  mass: number;
  g: number;
  damping: number;
  angleDeg: number;
}
export interface SpringSetup {
  mode: 'spring';
  k: number;
  mass: number;
  damping: number;
  displacement: number;
}
export type Setup = PendulumSetup | SpringSetup;

export const DT = 0.002; // s, fixed physics step (500 Hz)
export const HISTORY_HZ = 60;
export const WINDOW_S = 12;
/** History channels, in order. Position is degrees (pendulum) or metres (spring). */
export const CHANNELS = ['position', 'ke', 'pe', 'total'] as const;

export interface Theory {
  small: number;
  /** Exact large-angle period (pendulum only, undamped). */
  exact: number | null;
  /** Small-amplitude period including damping; null when there is no damping or it is over-damped. */
  damped: number | null;
  /** Fractional error of the small-angle formula vs the exact period (pendulum only). */
  smallAngleError: number | null;
}

export interface Snapshot {
  time: number;
  /** Radians (pendulum) or metres (spring). */
  x: number;
  v: number;
  ke: number;
  pe: number;
  total: number;
  measuredLast: number | null;
  measuredMean: number | null;
  cycles: number;
  theory: Theory;
}

export function theoryFor(s: Setup): Theory {
  if (s.mode === 'pendulum') {
    const small = pendulumPeriodSmall(s);
    const theta0 = (s.angleDeg * Math.PI) / 180;
    const omega0 = Math.sqrt(s.g / s.length);
    const gamma = s.damping / (s.mass * s.length * s.length);
    const damped = gamma > 0 ? dampedPeriod(omega0, gamma) : Number.NaN;
    return {
      small,
      exact: pendulumPeriodExact(s, theta0),
      damped: Number.isFinite(damped) ? damped : null,
      smallAngleError: smallAngleError(theta0),
    };
  }
  const small = springPeriod(s);
  const damped = s.damping > 0 ? dampedPeriod(Math.sqrt(s.k / s.mass), s.damping / s.mass) : Number.NaN;
  return { small, exact: null, damped: Number.isFinite(damped) ? damped : null, smallAngleError: null };
}

/** Everything the lab needs to simulate one oscillator, with no React or Three.js. */
export class OscillatorEngine {
  setup: Setup;
  readonly state: State = { x: 0, v: 0 };
  time = 0;
  running = true;
  speed = 1;
  readonly history = new History(HISTORY_HZ * WINDOW_S, CHANNELS.length);

  private readonly clock = new FixedStepClock(DT);
  private readonly meter = new PeriodMeter();
  private accel: Accel;
  private nextSample = 0;
  private readonly sampleBuf = new Float64Array(CHANNELS.length);

  constructor(setup: Setup) {
    this.setup = setup;
    this.accel = this.buildAccel();
    this.restart();
  }

  /**
   * Apply new parameters. Changing damping mid-run is allowed (the motion continues);
   * any other change starts a fresh run, because the physical system itself changed.
   */
  configure(next: Setup): void {
    const prev = this.setup;
    const dampingOnly =
      prev.mode === next.mode &&
      (Object.keys(next) as (keyof Setup)[]).every((k) => k === 'damping' || prev[k as never] === next[k]);
    this.setup = next;
    this.accel = this.buildAccel();
    if (!dampingOnly) this.restart();
  }

  restart(): void {
    const s = this.setup;
    this.state.x = s.mode === 'pendulum' ? (s.angleDeg * Math.PI) / 180 : s.displacement;
    this.state.v = 0;
    this.time = 0;
    this.nextSample = 0;
    this.clock.reset();
    this.meter.reset();
    this.history.clear();
    this.record();
  }

  setRunning(running: boolean): void {
    this.running = running;
  }

  /** Call once per display frame. */
  update(frameDt: number): void {
    if (!this.running) return;
    this.clock.advance(frameDt * this.speed, () => this.step());
  }

  step(): void {
    rk4Step(this.accel, this.state, DT);
    this.time += DT;
    this.meter.feed(this.time, this.state.x);
    if (this.time >= this.nextSample) this.record();
  }

  energies(): Energies {
    const { x, v } = this.state;
    return this.setup.mode === 'pendulum'
      ? pendulumEnergies(this.setup, x, v)
      : springEnergies(this.setup, x, v);
  }

  snapshot(): Snapshot {
    const e = this.energies();
    return {
      time: this.time,
      x: this.state.x,
      v: this.state.v,
      ke: e.ke,
      pe: e.pe,
      total: e.ke + e.pe,
      measuredLast: this.meter.last,
      measuredMean: this.meter.mean,
      cycles: this.meter.count,
      theory: theoryFor(this.setup),
    };
  }

  private buildAccel(): Accel {
    return this.setup.mode === 'pendulum' ? pendulumAccel(this.setup) : springAccel(this.setup);
  }

  private record(): void {
    const e = this.energies();
    const pos = this.setup.mode === 'pendulum' ? (this.state.x * 180) / Math.PI : this.state.x;
    this.sampleBuf[0] = pos;
    this.sampleBuf[1] = e.ke;
    this.sampleBuf[2] = e.pe;
    this.sampleBuf[3] = e.ke + e.pe;
    this.history.push(this.time, this.sampleBuf);
    this.nextSample = this.time + 1 / HISTORY_HZ;
  }
}
