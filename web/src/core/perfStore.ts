import { create } from 'zustand';

export interface PerfSample {
  fps: number;
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  dpr: number;
}

/** Live render statistics for the optional `?perf=1` overlay. */
export const usePerf = create<{ sample: PerfSample | null; set: (s: PerfSample) => void }>((set) => ({
  sample: null,
  set: (sample) => set({ sample }),
}));

const params = () => (typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search));
export const perfHudEnabled = () => params().get('perf') === '1';
/** `?autoquality=off` disables automatic downgrading (used by screenshots and tests on software-rendered browsers). */
export const autoQualityEnabled = () => params().get('autoquality') !== 'off';
