import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useSettings } from '../store/settings';
import { usePerf, autoQualityEnabled, perfHudEnabled } from './perfStore';
import { FpsWatcher } from './quality';

/** Drop this inside any R3F <Canvas>: it watches the frame rate and switches the app to low graphics if it stays poor. */
export function Quality() {
  const watcher = useMemo(() => new FpsWatcher(), []);
  const lowGraphics = useSettings((s) => s.lowGraphics);
  const degrade = useSettings((s) => s.degradeGraphics);
  const gl = useThree((s) => s.gl);
  const auto = useMemo(autoQualityEnabled, []);
  const hud = useMemo(perfHudEnabled, []);
  const acc = useRef({ t: 0, frames: 0 });

  useFrame((_, dt) => {
    if (auto && !lowGraphics && watcher.push(dt)) degrade();
    if (!hud) return;
    acc.current.t += dt;
    acc.current.frames++;
    if (acc.current.t >= 0.5) {
      const { render, memory } = gl.info;
      usePerf.getState().set({
        fps: Math.round(acc.current.frames / acc.current.t),
        calls: render.calls,
        triangles: render.triangles,
        geometries: memory.geometries,
        textures: memory.textures,
        dpr: Number(gl.getPixelRatio().toFixed(2)),
      });
      acc.current = { t: 0, frames: 0 };
    }
  });
  return null;
}
