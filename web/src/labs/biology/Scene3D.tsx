import type { MutableRefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import { Quality } from '../../core/Quality';
import { CameraRig, type CameraCommand } from './CameraRig';
import { Cell } from './Cell';
import type { OrganelleId } from './config';
import { buildLayout, type Detail } from './layout';
import { useBiology } from './store';

interface Props {
  lowGraphics: boolean;
  reducedMotion: boolean;
  commands: MutableRefObject<CameraCommand[]>;
  label: (id: OrganelleId) => string;
}

export default function Scene3D({ lowGraphics, reducedMotion, commands, label }: Props) {
  const detail: Detail = lowGraphics ? 'low' : 'high';
  const layout = useMemo(() => buildLayout(detail), [detail]);
  const selected = useBiology((s) => s.selected);
  const resetNonce = useBiology((s) => s.resetNonce);
  return (
    <Canvas
      dpr={lowGraphics ? 1 : [1, 1.5]}
      gl={{ antialias: !lowGraphics, powerPreference: 'high-performance' }}
      camera={{ position: [3.6, 2.2, 7.6], fov: 45, near: 0.1, far: 60 }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true;
      }}
    >
      <color attach="background" args={['#0b1220']} />
      <hemisphereLight args={['#f0f9ff', '#1e293b', 1.5]} />
      <directionalLight position={[4, 6, 5]} intensity={1.6} />
      {!lowGraphics && <directionalLight position={[-5, -2, -4]} intensity={0.6} color="#a5b4fc" />}
      <Quality />
      <Cell layout={layout} detail={detail} reducedMotion={reducedMotion} label={label} />
      <CameraRig selected={selected} focus={layout.focus} resetNonce={resetNonce} reducedMotion={reducedMotion} commands={commands} />
    </Canvas>
  );
}
