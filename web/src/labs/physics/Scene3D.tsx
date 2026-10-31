import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Quality } from '../../core/Quality';
import type { OscillatorEngine, PendulumSetup, Setup, SpringSetup } from './sim/engine';

const ACCENT = '#38bdf8';
const bobRadius = (mass: number) => 0.07 + 0.05 * Math.cbrt(mass);

function PendulumModel({ engine, setup }: { engine: OscillatorEngine; setup: PendulumSetup }) {
  const arm = useRef<THREE.Group>(null);
  useFrame(() => {
    if (arm.current) arm.current.rotation.z = engine.state.x;
  });
  const L = setup.length;
  const r = bobRadius(setup.mass);
  return (
    <group position={[0, 1.45, 0]}>
      {/* equilibrium reference */}
      <mesh position={[0, -L / 2, -0.02]}><boxGeometry args={[0.01, L, 0.005]} /><meshBasicMaterial color="#475569" /></mesh>
      <mesh><boxGeometry args={[1.2, 0.08, 0.3]} /><meshLambertMaterial color="#64748b" /></mesh>
      <group ref={arm}>
        <mesh position={[0, -L / 2, 0]}><cylinderGeometry args={[0.012, 0.012, L, 8]} /><meshLambertMaterial color="#cbd5e1" /></mesh>
        <mesh position={[0, -L, 0]}><sphereGeometry args={[r, 24, 16]} /><meshLambertMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={0.25} /></mesh>
      </group>
      <mesh><sphereGeometry args={[0.035, 12, 8]} /><meshLambertMaterial color="#f8fafc" /></mesh>
    </group>
  );
}

const WALL_X = -1.8;
const NATURAL = 1.4; // spring natural length, m
const BLOCK = 0.4;

function SpringModel({ engine, setup }: { engine: OscillatorEngine; setup: SpringSetup }) {
  const block = useRef<THREE.Mesh>(null);
  const coil = useRef<THREE.Mesh>(null);
  const coilGeo = useMemo(() => {
    // Helix of unit length along +x, stretched with scale.x to follow the block.
    const turns = 12;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= turns * 24; i++) {
      const f = i / (turns * 24);
      const a = f * turns * 2 * Math.PI;
      pts.push(new THREE.Vector3(f, 0.11 * Math.cos(a), 0.11 * Math.sin(a)));
    }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 24, 0.014, 6, false);
    return geo;
  }, []);
  useFrame(() => {
    const restX = WALL_X + NATURAL + BLOCK / 2;
    const x = restX + engine.state.x;
    if (block.current) block.current.position.x = x;
    if (coil.current) {
      const len = x - BLOCK / 2 - WALL_X;
      coil.current.position.x = WALL_X;
      coil.current.scale.x = len;
    }
  });
  const restX = WALL_X + NATURAL + BLOCK / 2;
  const blockSize = 0.28 + 0.05 * Math.cbrt(setup.mass);
  return (
    <group position={[0, 0.1, 0]}>
      <mesh position={[WALL_X - 0.05, 0.3, 0]}><boxGeometry args={[0.1, 1, 0.6]} /><meshLambertMaterial color="#64748b" /></mesh>
      <mesh position={[0, -0.0 - blockSize / 2 - 0.02, 0]}><boxGeometry args={[4.4, 0.04, 0.6]} /><meshLambertMaterial color="#334155" /></mesh>
      {/* equilibrium marker */}
      <mesh position={[restX, -blockSize / 2 - 0.0, 0.31]}><boxGeometry args={[0.012, 0.5, 0.005]} /><meshBasicMaterial color="#facc15" /></mesh>
      <mesh ref={coil} geometry={coilGeo} position={[WALL_X, 0, 0]}><meshLambertMaterial color="#cbd5e1" /></mesh>
      <mesh ref={block} position={[restX, 0, 0]}><boxGeometry args={[BLOCK, blockSize, blockSize]} /><meshLambertMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={0.25} /></mesh>
    </group>
  );
}

export interface Scene3DProps {
  engine: OscillatorEngine;
  setup: Setup;
  lowGraphics: boolean;
}

export default function Scene3D({ engine, setup, lowGraphics }: Scene3DProps) {
  return (
    <Canvas
      key={setup.mode}
      dpr={lowGraphics ? 1 : [1, 1.5]}
      gl={{ antialias: !lowGraphics, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, setup.mode === 'pendulum' ? 5.2 : 3.8], fov: 45 }}
    >
      <color attach="background" args={['#0b1220']} />
      <hemisphereLight args={['#e0f2fe', '#1e293b', 1.4]} />
      <directionalLight position={[2, 3, 4]} intensity={1.2} />
      <Quality />
      {setup.mode === 'pendulum' ? <PendulumModel engine={engine} setup={setup} /> : <SpringModel engine={engine} setup={setup} />}
    </Canvas>
  );
}
