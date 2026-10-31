import { stageEnergies } from './energy';
import { buildTimeline, sample, type Timeline } from './timeline';
import { bondId } from './validate';
import type { BondDef, ReactionData } from './types';

export interface BondTrack {
  id: string;
  a: number; // atom index
  b: number;
  order: 1 | 2 | 3;
  type: 'covalent' | 'ionic';
}

export interface PlayerSnapshot {
  time: number;
  total: number;
  /** Stage the caption should describe (the one we are heading to while moving). */
  stage: number;
  stageCount: number;
  playing: boolean;
  moving: boolean;
  atStart: boolean;
  atEnd: boolean;
  glow: number;
  energy: number;
}

const EPS = 1e-6;

/**
 * Plays any ReactionData: interpolates atom positions between stage keyframes, fades bonds in/out,
 * and supports continuous play, single-step forward/back, and scrubbing. No React, no Three.js.
 */
export class ReactionPlayer {
  readonly timeline: Timeline;
  readonly bonds: BondTrack[];
  /** xyz per atom, updated by evaluate(). */
  readonly positions: Float64Array;
  /** 0–1 per bond track. */
  readonly bondValues: Float64Array;
  glow = 0;
  energy = 0;
  readonly energyLevels: number[];
  readonly energyQuantitative: boolean;

  time = 0;
  speed = 1;
  playing = false;
  private target: number | null = null;
  private from = 0;
  private to = 0;
  private u = 0;
  private raw = 0;
  private readonly atomIndex: Map<string, number>;
  private readonly stagePos: Float64Array[];
  private readonly stageBond: Uint8Array[];

  constructor(readonly data: ReactionData) {
    this.timeline = buildTimeline(data.stages);
    this.atomIndex = new Map(data.atoms.map((a, i) => [a.id, i]));
    this.positions = new Float64Array(data.atoms.length * 3);

    const tracks = new Map<string, BondTrack>();
    for (const st of data.stages)
      for (const b of st.bonds) {
        const id = bondId(b);
        if (!tracks.has(id)) tracks.set(id, this.makeTrack(id, b));
      }
    this.bonds = [...tracks.values()];
    this.bondValues = new Float64Array(this.bonds.length);

    this.stagePos = data.stages.map((st) => {
      const arr = new Float64Array(data.atoms.length * 3);
      data.atoms.forEach((a, i) => arr.set(st.positions[a.id]!, i * 3));
      return arr;
    });
    this.stageBond = data.stages.map((st) => {
      const present = new Set(st.bonds.map(bondId));
      return Uint8Array.from(this.bonds.map((t) => (present.has(t.id) ? 1 : 0)));
    });
    const e = stageEnergies(data);
    this.energyLevels = e.levels;
    this.energyQuantitative = e.quantitative;
    this.evaluate();
  }

  private makeTrack(id: string, b: BondDef): BondTrack {
    return { id, a: this.atomIndex.get(b.a)!, b: this.atomIndex.get(b.b)!, order: b.order, type: b.type ?? 'covalent' };
  }

  /** Fractional stage index (e.g. 2.5 = halfway from stage 2 to 3), linear in time. */
  get progress(): number {
    return this.from + (this.to - this.from) * this.raw;
  }

  /** Time at which the final stage is reached (the end of the animation, ignoring its closing dwell). */
  private get lastArrival(): number {
    return this.timeline.arrive[this.stageCount - 1]!;
  }

  get stageCount(): number {
    return this.data.stages.length;
  }

  // ---- controls -----------------------------------------------------------------
  play(): void {
    if (this.time >= this.lastArrival - EPS) this.time = 0;
    this.target = null;
    this.playing = true;
  }
  pause(): void {
    this.playing = false;
    this.target = null;
  }
  restart(): void {
    this.time = 0;
    this.target = null;
    this.playing = false;
    this.evaluate();
  }
  /** If resting in a stage's dwell period, returns that stage's index. */
  private dwellingStage(): number {
    const { arrive, holdEnd } = this.timeline;
    return arrive.findIndex((a, i) => this.time >= a - EPS && this.time <= holdEnd[i]! + EPS);
  }

  /** Animate to the next stage boundary, then pause. Skips the dwell (nothing moves during it). */
  next(): void {
    this.playing = false;
    const i = this.dwellingStage();
    if (i >= 0 && i < this.stageCount - 1) this.time = this.timeline.holdEnd[i]!;
    const t = this.timeline.arrive.find((a) => a > this.time + EPS);
    this.target = t ?? null;
    this.evaluate();
  }
  /** Animate back to the previous stage boundary, then pause. */
  prev(): void {
    this.playing = false;
    const i = this.dwellingStage();
    if (i >= 0) this.time = this.timeline.arrive[i]!;
    const before = this.timeline.arrive.filter((a) => a < this.time - EPS);
    this.target = before.length ? before[before.length - 1]! : 0;
    this.evaluate();
  }
  goToStage(i: number): void {
    this.playing = false;
    this.target = this.timeline.arrive[Math.min(Math.max(i, 0), this.stageCount - 1)]!;
  }
  /** Jump straight to a time (scrubbing), pausing playback. */
  seek(t: number): void {
    this.playing = false;
    this.target = null;
    this.time = Math.min(Math.max(t, 0), this.timeline.total);
    this.evaluate();
  }

  // ---- time stepping ------------------------------------------------------------
  update(dt: number): void {
    const step = Math.max(0, dt) * this.speed;
    if (this.target !== null) {
      const diff = this.target - this.time;
      const move = Math.min(Math.abs(diff), step);
      this.time += Math.sign(diff) * move;
      if (Math.abs(this.target - this.time) < EPS) {
        this.time = this.target;
        this.target = null;
      }
    } else if (this.playing) {
      this.time = Math.min(this.time + step, this.timeline.total);
      if (this.time >= this.timeline.total - EPS) this.playing = false;
    } else return;
    this.evaluate();
  }

  evaluate(): void {
    const s = sample(this.timeline, this.time);
    this.from = s.from;
    this.to = s.to;
    this.u = s.u;
    this.raw = s.raw;
    const A = this.stagePos[s.from]!;
    const B = this.stagePos[s.to]!;
    for (let i = 0; i < this.positions.length; i++) this.positions[i] = A[i]! + (B[i]! - A[i]!) * s.u;
    const bA = this.stageBond[s.from]!;
    const bB = this.stageBond[s.to]!;
    for (let k = 0; k < this.bondValues.length; k++) this.bondValues[k] = bA[k]! + (bB[k]! - bA[k]!) * s.u;
    const st = this.data.stages;
    this.glow = (st[s.from]!.glow ?? 0) + ((st[s.to]!.glow ?? 0) - (st[s.from]!.glow ?? 0)) * s.u;
    this.energy = this.energyLevels[s.from]! + (this.energyLevels[s.to]! - this.energyLevels[s.from]!) * s.u;
  }

  snapshot(): PlayerSnapshot {
    const moving = this.playing || this.target !== null;
    return {
      time: this.time,
      total: this.timeline.total,
      stage: this.u > 0 ? this.to : this.from,
      stageCount: this.stageCount,
      playing: this.playing,
      moving,
      atStart: this.time <= EPS,
      atEnd: this.time >= this.lastArrival - EPS,
      glow: this.glow,
      energy: this.energy,
    };
  }
}
