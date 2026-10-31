export interface TimelineInput {
  duration?: number;
  hold?: number;
}

export interface Timeline {
  /** Time at which each stage is first fully reached. */
  arrive: number[];
  /** Time at which the dwell on each stage ends (and the next transition starts). */
  holdEnd: number[];
  total: number;
}

export interface Sample {
  from: number;
  to: number;
  /** Eased 0–1 progress between from and to (0 when resting on a stage). */
  u: number;
  /** Linear (un-eased) 0–1 progress, for plotting. */
  raw: number;
}

const DEFAULT_DURATION = 2;
const DEFAULT_HOLD = 0.8;

export function buildTimeline(stages: TimelineInput[]): Timeline {
  const arrive: number[] = [];
  const holdEnd: number[] = [];
  stages.forEach((s, i) => {
    const start = i === 0 ? 0 : holdEnd[i - 1]!;
    arrive.push(start + (i === 0 ? 0 : (s.duration ?? DEFAULT_DURATION)));
    holdEnd.push(arrive[i]! + (s.hold ?? DEFAULT_HOLD));
  });
  return { arrive, holdEnd, total: holdEnd[holdEnd.length - 1]! };
}

export const smoothstep = (x: number) => x * x * (3 - 2 * x);

export function sample(tl: Timeline, t: number): Sample {
  const time = Math.min(Math.max(t, 0), tl.total);
  const n = tl.arrive.length;
  if (time <= tl.holdEnd[0]!) return { from: 0, to: 0, u: 0, raw: 0 };
  for (let i = 1; i < n; i++) {
    const start = tl.holdEnd[i - 1]!;
    if (time < tl.arrive[i]!) {
      const raw = (time - start) / (tl.arrive[i]! - start);
      return { from: i - 1, to: i, u: smoothstep(raw), raw };
    }
    if (time <= tl.holdEnd[i]!) return { from: i, to: i, u: 0, raw: 0 };
  }
  return { from: n - 1, to: n - 1, u: 0, raw: 0 };
}
