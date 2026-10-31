import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Quality } from '../../core/Quality';
import { elementDef } from './engine/elements';
import { mulberry32 } from '../biology/layout';
import type { ReactionPlayer } from './engine/player';

const UP = new THREE.Vector3(0, 1, 0);

/** Soft radial gradient used for the exothermic glow (a hard-edged additive sphere looks like a muddy disc). */
function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,236,190,1)');
  grad.addColorStop(0.25, 'rgba(255,170,70,0.65)');
  grad.addColorStop(0.6, 'rgba(255,110,20,0.18)');
  grad.addColorStop(1, 'rgba(255,90,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const FOV = 45;

/** Keeps every stage of the reaction in view at any aspect ratio (portrait phones need to sit further back). */
function CameraFit({ player }: { player: ReactionPlayer }) {
  const camera = useThree((s) => s.camera);
  const aspect = useThree((s) => s.size.width / s.size.height);
  const bounds = useMemo(() => {
    let hw = 0;
    let hh = 0;
    for (const st of player.data.stages)
      for (const a of player.data.atoms) {
        const p = st.positions[a.id]!;
        const r = elementDef(a.el)!.radius;
        hw = Math.max(hw, Math.abs(p[0]) + r + 0.6);
        hh = Math.max(hh, Math.abs(p[1]) + r + 0.6);
      }
    return { hw, hh };
  }, [player]);
  useLayoutEffect(() => {
    const t = Math.tan((FOV * Math.PI) / 360);
    const dist = Math.max(bounds.hh / t, bounds.hw / (t * aspect));
    if (camera.position.lengthSq() < 1e-6) camera.position.set(0.25, 0.2, 1);
    camera.position.setLength(dist);
    camera.lookAt(0, 0, 0);
  }, [camera, aspect, bounds]);
  return null;
}

function Molecules({ player, lowGraphics, reducedMotion }: { player: ReactionPlayer; lowGraphics: boolean; reducedMotion: boolean }) {
  const atoms = player.data.atoms;
  const atomRefs = useRef<(THREE.Mesh | null)[]>([]);
  const bondRefs = useRef<(THREE.Mesh | null)[][]>([]);
  const halo = useRef<THREE.Sprite>(null);
  const glowTex = useMemo(glowTexture, []);
  useEffect(() => () => glowTex.dispose(), [glowTex]);
  const light = useRef<THREE.PointLight>(null);
  const sparks = useRef<THREE.InstancedMesh>(null);
  const seg = lowGraphics ? 12 : 24;
  const nSparks = lowGraphics ? 18 : 40;

  const atomMats = useMemo(() => {
    const m: Record<string, THREE.MeshLambertMaterial> = {};
    for (const a of atoms) m[a.el] ??= new THREE.MeshLambertMaterial({ color: elementDef(a.el)!.color, emissive: '#ff6a00', emissiveIntensity: 0 });
    return m;
  }, [atoms]);
  const covalent = useMemo(() => new THREE.MeshLambertMaterial({ color: '#cbd5e1' }), []);
  const ionic = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45 }), []);
  const bondGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, lowGraphics ? 6 : 10), [lowGraphics]);
  useEffect(() => () => {
    Object.values(atomMats).forEach((m) => m.dispose());
    covalent.dispose();
    ionic.dispose();
    bondGeo.dispose();
  }, [atomMats, covalent, ionic, bondGeo]);

  const dirs = useMemo(() => {
    const rnd = mulberry32(7);
    return Array.from({ length: nSparks }, () => {
      const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
      return { dir: v.lengthSq() < 1e-6 ? new THREE.Vector3(1, 0, 0) : v.normalize(), phase: rnd(), speed: 0.45 + rnd() * 0.5 };
    });
  }, [nSparks]);

  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), d: new THREE.Vector3(), perp: new THREE.Vector3(), q: new THREE.Quaternion(), o: new THREE.Object3D(), c: new THREE.Vector3() }), []);

  useFrame(({ clock }) => {
    const P = player.positions;
    const g = player.glow;
    tmp.c.set(0, 0, 0);
    atoms.forEach((a, i) => {
      atomRefs.current[i]?.position.set(P[i * 3]!, P[i * 3 + 1]!, P[i * 3 + 2]!);
      tmp.c.x += P[i * 3]!;
      tmp.c.y += P[i * 3 + 1]!;
      tmp.c.z += P[i * 3 + 2]!;
      atomMats[a.el]!.emissiveIntensity = g * 0.3;
    });
    tmp.c.multiplyScalar(1 / atoms.length);

    player.bonds.forEach((b, k) => {
      const v = player.bondValues[k]!;
      const meshes = bondRefs.current[k] ?? [];
      tmp.a.set(P[b.a * 3]!, P[b.a * 3 + 1]!, P[b.a * 3 + 2]!);
      tmp.b.set(P[b.b * 3]!, P[b.b * 3 + 1]!, P[b.b * 3 + 2]!);
      tmp.d.subVectors(tmp.b, tmp.a);
      const len = tmp.d.length();
      tmp.d.normalize();
      tmp.q.setFromUnitVectors(UP, tmp.d);
      // perpendicular offset for double/triple bonds
      tmp.perp.crossVectors(tmp.d, Math.abs(tmp.d.z) > 0.9 ? UP : new THREE.Vector3(0, 0, 1)).normalize();
      const n = meshes.length;
      meshes.forEach((m, j) => {
        if (!m) return;
        m.visible = v > 0.03;
        if (!m.visible) return;
        const off = n === 1 ? 0 : (j - (n - 1) / 2) * 0.14;
        m.position.copy(tmp.a).add(tmp.b).multiplyScalar(0.5).addScaledVector(tmp.perp, off);
        m.quaternion.copy(tmp.q);
        const r = (b.type === 'ionic' ? 0.04 : n === 1 ? 0.075 : 0.05) * v;
        m.scale.set(r, len, r);
      });
    });

    if (halo.current) {
      halo.current.position.copy(tmp.c);
      halo.current.scale.setScalar(5 + g * 5);
      (halo.current.material as THREE.SpriteMaterial).opacity = Math.min(1, g * 0.9);
      halo.current.visible = g > 0.01;
    }
    if (light.current) {
      light.current.position.copy(tmp.c);
      light.current.intensity = g * 35;
    }
    if (sparks.current) {
      const t = clock.elapsedTime;
      const show = g > 0.05 && !reducedMotion;
      for (let i = 0; i < dirs.length; i++) {
        const s = dirs[i]!;
        const ph = (t * s.speed + s.phase) % 1;
        tmp.o.position.copy(tmp.c).addScaledVector(s.dir, 1.2 + ph * 3.2);
        tmp.o.scale.setScalar(show ? (1 - ph) * g * 1.1 : 0);
        tmp.o.updateMatrix();
        sparks.current.setMatrixAt(i, tmp.o.matrix);
      }
      sparks.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {atoms.map((a, i) => (
        <mesh key={a.id} ref={(m) => { atomRefs.current[i] = m; }} material={atomMats[a.el]}>
          <sphereGeometry args={[elementDef(a.el)!.radius, seg, Math.round(seg * 0.7)]} />
        </mesh>
      ))}
      {player.bonds.map((b, k) => {
        const n = b.type === 'ionic' ? 1 : b.order;
        return Array.from({ length: n }, (_, j) => (
          <mesh
            key={`${b.id}-${j}`}
            ref={(m) => {
              (bondRefs.current[k] ??= [])[j] = m;
            }}
            geometry={bondGeo}
            material={b.type === 'ionic' ? ionic : covalent}
            visible={false}
          />
        ));
      })}
      <sprite ref={halo} visible={false} renderOrder={-1}>
        <spriteMaterial map={glowTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <pointLight ref={light} color="#ff9a3c" distance={14} intensity={0} />
      <instancedMesh ref={sparks} args={[undefined, undefined, nSparks]} frustumCulled={false}>
        <sphereGeometry args={[0.07, 6, 4]} />
        <meshBasicMaterial color="#ffd27a" transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
    </group>
  );
}

export interface Scene3DProps {
  player: ReactionPlayer;
  lowGraphics: boolean;
  reducedMotion: boolean;
}

export default function Scene3D({ player, lowGraphics, reducedMotion }: Scene3DProps) {
  return (
    <Canvas
      dpr={lowGraphics ? 1 : [1, 1.5]}
      gl={{ antialias: !lowGraphics, powerPreference: 'high-performance' }}
      camera={{ position: [0.25, 0.2, 12], fov: FOV, near: 0.1, far: 80 }}
    >
      <color attach="background" args={['#0b1220']} />
      <hemisphereLight args={['#e0f2fe', '#1e293b', 1.3]} />
      <directionalLight position={[4, 6, 6]} intensity={1.8} />
      <Quality />
      <Molecules player={player} lowGraphics={lowGraphics} reducedMotion={reducedMotion} />
      <CameraFit player={player} />
      <OrbitControls makeDefault enablePan={false} enableDamping={!reducedMotion} minDistance={3} maxDistance={40} />
    </Canvas>
  );
}
