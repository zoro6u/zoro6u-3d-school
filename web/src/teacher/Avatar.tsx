import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TeacherDef } from '../core/teachers';
import { blinkAmount } from './speech/level';
import { getSpeech } from './speech/webSpeech';

const flat = (color: string) => <meshLambertMaterial color={color} flatShading />;

function Character({ teacher, reducedMotion }: { teacher: TeacherDef; reducedMotion: boolean }) {
  const { skin, hair, outfit, accent, prop } = teacher.look;
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyeL = useRef<THREE.Mesh>(null);
  const eyeR = useRef<THREE.Mesh>(null);
  const browL = useRef<THREE.Mesh>(null);
  const browR = useRef<THREE.Mesh>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const level = useRef(0);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const target = getSpeech().getMouthLevel(performance.now());
    level.current += (target - level.current) * 0.4; // smooth so the mouth doesn't flicker
    const m = level.current;
    if (root.current) root.current.position.y = reducedMotion ? 0 : Math.sin(t * 1.6) * 0.02;
    if (head.current) {
      head.current.rotation.z = reducedMotion ? 0 : Math.sin(t * 0.9) * 0.04;
      head.current.rotation.y = reducedMotion ? 0 : Math.sin(t * 0.5) * 0.1;
      head.current.rotation.x = reducedMotion ? 0 : Math.sin(t * 5) * 0.025 * m;
    }
    const eyeScale = 1 - 0.92 * blinkAmount(t);
    if (eyeL.current) eyeL.current.scale.y = eyeScale;
    if (eyeR.current) eyeR.current.scale.y = eyeScale;
    if (browL.current) browL.current.position.y = 0.2 + m * 0.025;
    if (browR.current) browR.current.position.y = 0.2 + m * 0.025;
    if (mouth.current) {
      mouth.current.scale.y = 0.25 + m * 1.7;
      mouth.current.scale.x = 1 - m * 0.18;
    }
  });

  return (
    <group ref={root} position={[0, -0.1, 0]}>
      {/* body: lab coat with a coloured shirt panel */}
      <mesh position={[0, -1.05, 0]}><cylinderGeometry args={[0.5, 0.8, 0.95, 8]} />{flat('#f1f5f9')}</mesh>
      <mesh position={[0, -0.92, 0.5]} rotation={[0.18, 0, 0]}><boxGeometry args={[0.36, 0.55, 0.05]} />{flat(outfit)}</mesh>
      <mesh position={[0, -0.6, 0]}><cylinderGeometry args={[0.14, 0.17, 0.3, 8]} />{flat(skin)}</mesh>

      <group ref={head} position={[0, 0.1, 0]}>
        <mesh><icosahedronGeometry args={[0.5, 1]} />{flat(skin)}</mesh>
        <mesh position={[0.5, -0.02, 0]}><sphereGeometry args={[0.08, 6, 5]} />{flat(skin)}</mesh>
        <mesh position={[-0.5, -0.02, 0]}><sphereGeometry args={[0.08, 6, 5]} />{flat(skin)}</mesh>
        <mesh position={[0, -0.03, 0.5]}><coneGeometry args={[0.06, 0.14, 5]} />{flat(skin)}</mesh>

        <mesh ref={eyeL} position={[-0.18, 0.06, 0.45]}><sphereGeometry args={[0.065, 8, 6]} /><meshBasicMaterial color="#111827" /></mesh>
        <mesh ref={eyeR} position={[0.18, 0.06, 0.45]}><sphereGeometry args={[0.065, 8, 6]} /><meshBasicMaterial color="#111827" /></mesh>
        <mesh ref={browL} position={[-0.18, 0.2, 0.46]} rotation={[0, 0, 0.1]}><boxGeometry args={[0.16, 0.03, 0.03]} />{flat(hair)}</mesh>
        <mesh ref={browR} position={[0.18, 0.2, 0.46]} rotation={[0, 0, -0.1]}><boxGeometry args={[0.16, 0.03, 0.03]} />{flat(hair)}</mesh>
        <mesh ref={mouth} position={[0, -0.2, 0.47]}><boxGeometry args={[0.2, 0.06, 0.04]} /><meshBasicMaterial color="#7f1d1d" /></mesh>

        {/* hair: a cap, plus a bun / ponytail / nothing extra */}
        <mesh position={[0, 0.05, -0.02]} rotation={[-0.25, 0, 0]}>
          <sphereGeometry args={[0.54, 10, 8, 0, Math.PI * 2, 0, teacher.id === 'karim' ? Math.PI * 0.42 : Math.PI * 0.55]} />
          <meshLambertMaterial color={hair} flatShading side={THREE.DoubleSide} />
        </mesh>
        {teacher.id === 'nour' && <mesh position={[0, 0.6, -0.12]}><sphereGeometry args={[0.2, 8, 6]} />{flat(hair)}</mesh>}
        {teacher.id === 'layla' && (
          <>
            <mesh position={[0, -0.08, -0.55]} scale={[0.5, 1.1, 0.5]}><sphereGeometry args={[0.3, 8, 6]} />{flat(hair)}</mesh>
            <mesh position={[0, 0.12, -0.5]}><torusGeometry args={[0.1, 0.03, 5, 8]} />{flat(accent)}</mesh>
          </>
        )}
        {prop === 'glasses' && (
          <group position={[0, 0.06, 0.5]}>
            <mesh position={[-0.18, 0, 0]}><torusGeometry args={[0.1, 0.017, 6, 14]} />{flat('#111827')}</mesh>
            <mesh position={[0.18, 0, 0]}><torusGeometry args={[0.1, 0.017, 6, 14]} />{flat('#111827')}</mesh>
            <mesh><boxGeometry args={[0.1, 0.02, 0.02]} />{flat('#111827')}</mesh>
          </group>
        )}
      </group>

      {prop === 'clipboard' && (
        <group position={[0.62, -0.95, 0.45]} rotation={[0, -0.3, 0.15]}>
          <mesh><boxGeometry args={[0.34, 0.46, 0.04]} />{flat('#92400e')}</mesh>
          <mesh position={[0, 0, 0.025]}><boxGeometry args={[0.28, 0.38, 0.01]} />{flat('#f8fafc')}</mesh>
        </group>
      )}
      {prop === 'flask' && (
        <group position={[0.62, -0.9, 0.45]} rotation={[0, -0.3, 0.1]}>
          <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.04, 0.04, 0.18, 8]} /><meshLambertMaterial color="#e2e8f0" transparent opacity={0.8} /></mesh>
          <mesh position={[0, -0.08, 0]}><coneGeometry args={[0.17, 0.26, 8]} /><meshLambertMaterial color={accent} flatShading /></mesh>
        </group>
      )}
    </group>
  );
}

export default function Avatar({ teacher, reducedMotion, lowGraphics }: { teacher: TeacherDef; reducedMotion: boolean; lowGraphics: boolean }) {
  return (
    <Canvas
      dpr={lowGraphics ? 1 : [1, 1.75]}
      gl={{ antialias: !lowGraphics, alpha: true }}
      camera={{ position: [0, 0.1, 3.7], fov: 30 }}
      aria-hidden
    >
      <ambientLight intensity={1.2} />
      <directionalLight position={[2, 3, 4]} intensity={1.8} />
      <directionalLight position={[-3, 1, 2]} intensity={0.5} color={teacher.look.accent} />
      <Character teacher={teacher} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
