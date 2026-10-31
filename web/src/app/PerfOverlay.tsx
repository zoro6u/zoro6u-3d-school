import { perfHudEnabled, usePerf } from '../core/perfStore';

/** `?perf=1` shows live fps, draw calls and triangle counts. Handy when testing on a real phone. */
export function PerfOverlay() {
  const s = usePerf((p) => p.sample);
  if (!perfHudEnabled()) return null;
  return (
    <pre aria-hidden className="pointer-events-none fixed start-1 top-1 z-50 m-0 rounded bg-black/70 p-1.5 font-mono text-[11px] leading-tight text-lime-300" dir="ltr">
      {s ? `fps ${s.fps}\ncalls ${s.calls}\ntris ${s.triangles}\ngeo ${s.geometries} tex ${s.textures}\ndpr ${s.dpr}` : 'perf…'}
    </pre>
  );
}
