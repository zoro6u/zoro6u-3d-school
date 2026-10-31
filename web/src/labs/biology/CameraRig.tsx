import { useEffect, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { CELL_RADIUS, specOf, type OrganelleId } from './config';
import type { Vec3 } from './layout';

export type CameraCommand = { type: 'rotate'; dx: number; dy: number } | { type: 'zoom'; factor: number };

const HOME_POS = new THREE.Vector3(3.6, 2.2, 7.6);
const HOME_TARGET = new THREE.Vector3(0, 0, 0);

interface Props {
  selected: OrganelleId | null;
  focus: Record<OrganelleId, Vec3>;
  resetNonce: number;
  reducedMotion: boolean;
  commands: MutableRefObject<CameraCommand[]>;
}

/** Orbit controls plus a smooth "fly to the selected organelle" tween that the user can interrupt by dragging. */
export function CameraRig({ selected, focus, resetNonce, reducedMotion, commands }: Props) {
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const goal = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const { camera } = useThree();

  useEffect(() => {
    const target = new THREE.Vector3();
    if (!selected) {
      goal.current = { pos: HOME_POS.clone(), target: HOME_TARGET.clone() };
      return;
    }
    target.set(...focus[selected]);
    // View from outside along the centre → organelle direction; fall back to the current view direction.
    const dir = target.clone();
    if (dir.length() < 0.6) dir.copy(camera.position).sub(controls.current?.target ?? HOME_TARGET);
    dir.normalize();
    const dist = specOf(selected).focusDistance;
    const pos = selected === 'membrane' ? HOME_POS.clone().setLength(dist) : target.clone().add(dir.multiplyScalar(dist));
    goal.current = { pos, target };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- camera is stable; only react to selection/reset
  }, [selected, resetNonce, focus]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const stop = () => (goal.current = null);
    c.addEventListener('start', stop);
    return () => c.removeEventListener('start', stop);
  }, []);

  useFrame((_, delta) => {
    const c = controls.current;
    if (!c) return;
    for (const cmd of commands.current.splice(0)) {
      goal.current = null;
      const off = camera.position.clone().sub(c.target);
      if (cmd.type === 'zoom') {
        off.multiplyScalar(cmd.factor);
        off.setLength(THREE.MathUtils.clamp(off.length(), 1.2, 16));
      } else {
        const sph = new THREE.Spherical().setFromVector3(off);
        sph.theta -= cmd.dx;
        sph.phi = THREE.MathUtils.clamp(sph.phi - cmd.dy, 0.15, Math.PI - 0.15);
        off.setFromSpherical(sph);
      }
      camera.position.copy(c.target).add(off);
    }
    const g = goal.current;
    if (g) {
      const k = reducedMotion ? 1 : 1 - Math.exp(-delta * 5);
      camera.position.lerp(g.pos, k);
      c.target.lerp(g.target, k);
      if (camera.position.distanceTo(g.pos) < 0.01 && c.target.distanceTo(g.target) < 0.01) goal.current = null;
    }
    c.update();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping={!reducedMotion}
      dampingFactor={0.08}
      minDistance={1.2}
      maxDistance={CELL_RADIUS * 5}
      autoRotate={!selected && !reducedMotion}
      autoRotateSpeed={0.5}
      enablePan={false}
    />
  );
}
