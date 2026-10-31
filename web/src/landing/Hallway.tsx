import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';
import type { LessonMeta, Subject } from '../core/lessons';
import { Quality } from '../core/Quality';

const HALL = { w: 12, h: 4, d: 16 };
const DOOR_X: Record<Subject, number> = { biology: -3.6, physics: 0, chemistry: 3.6 };

function checkerTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#cbd5e1';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#94a3b8';
  g.fillRect(0, 0, 32, 32);
  g.fillRect(32, 32, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(HALL.w / 2, HALL.d / 2);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Lockers({ side }: { side: 1 | -1 }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 14;
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      o.position.set(side * (HALL.w / 2 - 0.25), 1, -HALL.d / 2 + 1.6 + i * 0.9);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, col.set(i % 3 === 0 ? '#475569' : '#64748b'));
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [side]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <boxGeometry args={[0.5, 2, 0.8]} />
      <meshLambertMaterial />
    </instancedMesh>
  );
}

function Emblem({ subject, color }: { subject: Subject; color: string }) {
  const mat = <meshLambertMaterial color={color} emissive={color} emissiveIntensity={0.35} />;
  if (subject === 'biology')
    return (
      <group>
        <mesh><sphereGeometry args={[0.32, 20, 14]} />{mat}</mesh>
        <mesh position={[0.1, 0.05, 0.28]}><sphereGeometry args={[0.1, 12, 10]} /><meshLambertMaterial color="#f8fafc" /></mesh>
      </group>
    );
  if (subject === 'physics')
    return (
      <group>
        <mesh position={[0, 0.15, 0]}><cylinderGeometry args={[0.015, 0.015, 0.6, 6]} />{mat}</mesh>
        <mesh position={[0, -0.2, 0]}><sphereGeometry args={[0.14, 16, 12]} />{mat}</mesh>
      </group>
    );
  return (
    <group>
      <mesh position={[-0.2, -0.08, 0]}><sphereGeometry args={[0.15, 16, 12]} />{mat}</mesh>
      <mesh position={[0.2, -0.08, 0]}><sphereGeometry args={[0.15, 16, 12]} />{mat}</mesh>
      <mesh position={[0, 0.18, 0]}><sphereGeometry args={[0.2, 16, 12]} />{mat}</mesh>
    </group>
  );
}

function Door({ lesson, active, onHover }: { lesson: LessonMeta; active: boolean; onHover: (s: Subject | null) => void }) {
  const navigate = useNavigate();
  const x = DOOR_X[lesson.subject];
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [active, invalidate]);
  return (
    <group position={[x, 0, -HALL.d / 2 + 0.05]}>
      <mesh position={[0, 1.3, 0]}><boxGeometry args={[2, 2.8, 0.15]} /><meshLambertMaterial color="#334155" /></mesh>
      <mesh
        position={[0, 1.2, 0.09]}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; onHover(lesson.subject); }}
        onPointerOut={() => { document.body.style.cursor = ''; onHover(null); }}
        onClick={(e) => { e.stopPropagation(); void navigate(lesson.route); }}
      >
        <boxGeometry args={[1.6, 2.4, 0.08]} />
        <meshLambertMaterial color={lesson.accent} emissive={lesson.accent} emissiveIntensity={active ? 0.9 : 0.15} />
      </mesh>
      <mesh position={[0.55, 1.15, 0.16]}><sphereGeometry args={[0.07, 10, 8]} /><meshLambertMaterial color="#fde68a" /></mesh>
      <group position={[0, 3.05, 0.1]} scale={active ? 1.15 : 1}><Emblem subject={lesson.subject} color={lesson.accent} /></group>
    </group>
  );
}

function Rig({ reducedMotion }: { reducedMotion: boolean }) {
  useFrame((state) => {
    const targetX = reducedMotion ? 0 : state.pointer.x * 0.7;
    const targetY = 1.6 + (reducedMotion ? 0 : state.pointer.y * 0.15);
    state.camera.position.x += (targetX - state.camera.position.x) * 0.05;
    state.camera.position.y += (targetY - state.camera.position.y) * 0.05;
    state.camera.lookAt(0, 1.5, -HALL.d / 2);
  });
  return null;
}

export interface HallwayProps {
  lessons: LessonMeta[];
  hovered: Subject | null;
  onHover: (s: Subject | null) => void;
  lowGraphics: boolean;
  reducedMotion: boolean;
}

export default function Hallway({ lessons, hovered, onHover, lowGraphics, reducedMotion }: HallwayProps) {
  const floorTex = useMemo(checkerTexture, []);
  useEffect(() => () => floorTex.dispose(), [floorTex]);
  return (
    <Canvas
      frameloop={reducedMotion ? 'demand' : 'always'}
      dpr={lowGraphics ? 1 : [1, 1.5]}
      gl={{ antialias: !lowGraphics, powerPreference: 'high-performance' }}
      camera={{ position: [0, 1.6, HALL.d / 2 - 1], fov: 60 }}
    >
      <color attach="background" args={['#0f172a']} />
      <hemisphereLight args={['#e0f2fe', '#1e293b', 1.1]} />
      {!lowGraphics && <pointLight position={[0, 2.6, -2]} intensity={9} color="#fff7ed" />}
      <mesh rotation-x={-Math.PI / 2}><planeGeometry args={[HALL.w, HALL.d]} /><meshLambertMaterial map={floorTex} /></mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, HALL.h, 0]}><planeGeometry args={[HALL.w, HALL.d]} /><meshLambertMaterial color="#e2e8f0" /></mesh>
      <mesh position={[0, HALL.h / 2, -HALL.d / 2]}><planeGeometry args={[HALL.w, HALL.h]} /><meshLambertMaterial color="#1e293b" /></mesh>
      {([-1, 1] as const).map((side) => (
        <group key={side}>
          <mesh position={[side * HALL.w / 2, HALL.h / 2, 0]} rotation-y={-side * Math.PI / 2}><planeGeometry args={[HALL.d, HALL.h]} /><meshLambertMaterial color="#334155" /></mesh>
          <Lockers side={side} />
        </group>
      ))}
      {[-6, -2, 2, 6].map((z) => (
        <mesh key={z} position={[0, HALL.h - 0.05, z]}><boxGeometry args={[1.6, 0.06, 0.4]} /><meshBasicMaterial color="#fffbeb" /></mesh>
      ))}
      {lessons.map((l) => (
        <Door key={l.id} lesson={l} active={hovered === l.subject} onHover={onHover} />
      ))}
      <Rig reducedMotion={reducedMotion} />
      <Quality />
    </Canvas>
  );
}
