import { useEffect, useState } from 'react';
import type { OscillatorEngine, Snapshot } from './sim/engine';

/** Drives the simulation from requestAnimationFrame, independent of whether WebGL is available. */
export function useSimLoop(engine: OscillatorEngine): void {
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      engine.update((now - last) / 1000);
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine]);
}

/** React re-renders at ~10 Hz for readouts; the 3D scene and charts read the engine directly at full rate. */
export function useSnapshot(engine: OscillatorEngine, intervalMs = 100): Snapshot {
  const [snap, setSnap] = useState(() => engine.snapshot());
  useEffect(() => {
    const id = setInterval(() => setSnap(engine.snapshot()), intervalMs);
    return () => clearInterval(id);
  }, [engine, intervalMs]);
  return snap;
}
