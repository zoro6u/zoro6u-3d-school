import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CELL_RADIUS, isOrganelleId, organelles, type OrganelleId } from './config';
import { ER_SHELLS, GOLGI, LYSO_POSITIONS, MITO_POSITIONS, NUCLEUS, type CellLayout, type Detail } from './layout';
import { inCutaway, resolvePick } from './pick';
import { useBiology } from './store';

/** Two planes + clipIntersection remove the wedge x > 0 && z > 0. */
const CUT_PLANES = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)];

function organelleOf(obj: THREE.Object3D | null): OrganelleId | null {
  for (let o = obj; o; o = o.parent) {
    const id = o.userData.organelle as unknown;
    if (isOrganelleId(id)) return id;
  }
  return null;
}

interface Props {
  layout: CellLayout;
  detail: Detail;
  reducedMotion: boolean;
  label: (id: OrganelleId) => string;
}

export function Cell({ layout, detail, reducedMotion, label }: Props) {
  const selected = useBiology((s) => s.selected);
  const cutaway = useBiology((s) => s.cutaway);
  const select = useBiology((s) => s.select);
  const hovered = useRef<OrganelleId | null>(null);
  const seg = detail === 'high' ? 1 : 0.6;
  const s = (n: number) => Math.max(6, Math.round(n * seg));

  // One shared material per organelle (instancing needs shared materials; it also makes highlighting trivial).
  const colorOf = useMemo(() => Object.fromEntries(organelles.map((o) => [o.id, o.color])) as Record<OrganelleId, string>, []);
  const mats = useMemo(() => {
    const reg: Record<OrganelleId, THREE.MeshLambertMaterial[]> = {
      nucleus: [], mitochondria: [], ribosomes: [], roughEr: [], smoothEr: [], golgi: [], lysosomes: [], membrane: [], cytoplasm: [],
    };
    const make = (id: OrganelleId, opts: { opacity?: number; color?: string; side?: THREE.Side; depthWrite?: boolean } = {}) => {
      const m = new THREE.MeshLambertMaterial({
        color: opts.color ?? colorOf[id],
        emissive: colorOf[id],
        emissiveIntensity: 0.08,
        transparent: opts.opacity !== undefined,
        opacity: opts.opacity ?? 1,
        side: opts.side ?? THREE.FrontSide,
        depthWrite: opts.depthWrite ?? true,
      });
      reg[id].push(m);
      return m;
    };
    return {
      reg,
      nucleusEnv: make('nucleus', { opacity: 0.38, side: THREE.DoubleSide, depthWrite: false }),
      chromatin: make('nucleus', { color: '#6d28d9' }),
      nucleolus: make('nucleus', { color: '#4c1d95' }),
      mitoOuter: make('mitochondria', { opacity: 0.6, depthWrite: false }),
      mitoInner: make('mitochondria', { color: '#b91c1c' }),
      ribo: make('ribosomes'),
      rer: make('roughEr', { side: THREE.DoubleSide }),
      ser: make('smoothEr'),
      golgi: make('golgi', { side: THREE.DoubleSide }),
      lyso: make('lysosomes'),
      membrane: make('membrane', { opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
      cytoplasm: make('cytoplasm', { opacity: 0.07, side: THREE.FrontSide, depthWrite: false }),
    };
  }, [colorOf]);
  useEffect(() => () => Object.values(mats.reg).flat().forEach((m) => m.dispose()), [mats]);

  // Cutaway: only the translucent shells are clipped; organelles stay whole so the wedge reveals them.
  useEffect(() => {
    for (const m of [mats.membrane, mats.cytoplasm]) {
      m.clippingPlanes = cutaway ? CUT_PLANES : null;
      m.clipIntersection = true;
      m.needsUpdate = true;
    }
  }, [cutaway, mats]);

  // Instanced ribosomes (free + ER-bound) and lysosomes.
  const riboRef = useRef<THREE.InstancedMesh>(null);
  const lysoRef = useRef<THREE.InstancedMesh>(null);
  const riboPts = useMemo(() => [...layout.erRibosomes, ...layout.freeRibosomes], [layout]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const place = (mesh: THREE.InstancedMesh | null, pts: readonly (readonly [number, number, number])[]) => {
      if (!mesh) return;
      pts.forEach((p, i) => {
        o.position.set(p[0], p[1], p[2]);
        o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    place(riboRef.current, riboPts);
    place(lysoRef.current, LYSO_POSITIONS);
  }, [riboPts]);

  const mitoRot = useMemo(
    () => MITO_POSITIONS.map((_, i): [number, number, number] => [0.4 + i * 0.9, i * 1.3, 0.3 + i * 0.7]),
    [],
  );
  const serGeos = useMemo(
    () => layout.serTubes.map((pts) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), s(28), 0.055, 6, false)),
    [layout, detail], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => () => serGeos.forEach((g) => g.dispose()), [serGeos]);

  // Highlight: selected pulses, hovered glows, everything else rests. Cheap: ~15 materials.
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    // Fade the translucent shells while an inner organelle is in focus, so it isn't seen through fog.
    const inner = selected !== null && selected !== 'membrane' && selected !== 'cytoplasm';
    const k = 1 - Math.exp(-delta * 6);
    mats.membrane.opacity += ((inner ? 0.07 : 0.16) - mats.membrane.opacity) * k;
    mats.cytoplasm.opacity += ((inner ? 0.02 : 0.07) - mats.cytoplasm.opacity) * k;
    for (const id of Object.keys(mats.reg) as OrganelleId[]) {
      const base = id === selected ? (reducedMotion ? 0.75 : 0.6 + 0.3 * Math.sin(t * 3.2)) : id === hovered.current ? 0.45 : 0.08;
      for (const m of mats.reg[id]) m.emissiveIntensity = base;
    }
  });

  const pickFrom = (e: ThreeEvent<PointerEvent | MouseEvent>): OrganelleId | null => {
    const ids: OrganelleId[] = [];
    for (const hit of e.intersections) {
      const id = organelleOf(hit.object);
      if (!id) continue;
      // Raycasting ignores clipping planes, so drop shell hits inside the removed wedge.
      if (cutawayRef.current && (id === 'membrane' || id === 'cytoplasm') && inCutaway([hit.point.x, hit.point.y, hit.point.z])) continue;
      ids.push(id);
    }
    return resolvePick(ids);
  };
  const cutawayRef = useRef(cutaway);
  cutawayRef.current = cutaway;

  const labelPos = selected ? layout.focus[selected] : null;
  const gl = { r: CELL_RADIUS };

  return (
    <group
      onPointerMove={(e) => {
        const id = pickFrom(e);
        if (id !== hovered.current) {
          hovered.current = id;
          document.body.style.cursor = id ? 'pointer' : '';
        }
      }}
      onPointerOut={() => {
        hovered.current = null;
        document.body.style.cursor = '';
      }}
      onClick={(e) => {
        if (e.delta > 4) return; // it was a drag, not a click
        e.stopPropagation();
        const id = pickFrom(e);
        if (id) select(id);
      }}
      onPointerMissed={(e) => {
        if (e.type === 'click') select(null);
      }}
    >
      {/* cell membrane + cytoplasm */}
      <mesh userData={{ organelle: 'membrane' }} material={mats.membrane}><sphereGeometry args={[gl.r, s(48), s(32)]} /></mesh>
      <mesh userData={{ organelle: 'cytoplasm' }} material={mats.cytoplasm}><sphereGeometry args={[gl.r * 0.93, s(40), s(28)]} /></mesh>

      {/* nucleus */}
      <group userData={{ organelle: 'nucleus' }} position={NUCLEUS.center}>
        <mesh material={mats.nucleusEnv}><sphereGeometry args={[NUCLEUS.radius, s(32), s(24)]} /></mesh>
        <mesh material={mats.chromatin} scale={[1, 0.9, 1]}><torusKnotGeometry args={[0.38, 0.06, s(80), 6, 2, 3]} /></mesh>
        <mesh material={mats.nucleolus} position={[0.22, 0.08, 0.2]}><sphereGeometry args={[0.2, s(16), s(12)]} /></mesh>
      </group>

      {/* rough ER: stacked curved sheets */}
      <group userData={{ organelle: 'roughEr' }} position={NUCLEUS.center}>
        {ER_SHELLS.map((sh, i) => (
          <mesh key={i} material={mats.rer}>
            <sphereGeometry args={[sh.radius, s(36), s(20), sh.phiStart, sh.phiLength, sh.thetaStart, sh.thetaLength]} />
          </mesh>
        ))}
      </group>

      {/* smooth ER: tubes */}
      <group userData={{ organelle: 'smoothEr' }}>
        {serGeos.map((g, i) => <mesh key={i} geometry={g} material={mats.ser} />)}
      </group>

      {/* Golgi: stack of curved cisternae + vesicles */}
      <group userData={{ organelle: 'golgi' }} position={GOLGI.center} rotation={[0.5, 0.9, 0.3]}>
        {Array.from({ length: GOLGI.discs }, (_, i) => {
          const taper = 1 - Math.abs(i - (GOLGI.discs - 1) / 2) * 0.12;
          return (
            <mesh key={i} material={mats.golgi} position={[0, (i - (GOLGI.discs - 1) / 2) * GOLGI.spacing, 0]} scale={[taper, 0.17, taper]}>
              <sphereGeometry args={[GOLGI.radius * 0.9, s(24), s(14)]} />
            </mesh>
          );
        })}
        {[[0.7, 0.25, 0.1], [-0.65, -0.15, 0.3], [0.5, -0.3, -0.5]].map((p, i) => (
          <mesh key={`v${i}`} material={mats.golgi} position={p as [number, number, number]}><sphereGeometry args={[0.07, 8, 6]} /></mesh>
        ))}
      </group>

      {/* mitochondria: translucent capsule with cristae */}
      {MITO_POSITIONS.map((p, i) => (
        <group key={i} userData={{ organelle: 'mitochondria' }} position={p} rotation={mitoRot[i]}>
          <mesh material={mats.mitoOuter}><capsuleGeometry args={[0.16, 0.42, 4, s(12)]} /></mesh>
          {[-0.27, -0.13, 0, 0.13, 0.27].map((y, k) => (
            <mesh key={k} material={mats.mitoInner} position={[k % 2 ? 0.045 : -0.045, y, 0]} scale={[1, 1, 0.9]}>
              <cylinderGeometry args={[0.1, 0.1, 0.022, 10]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* instanced: ribosomes and lysosomes */}
      <instancedMesh ref={riboRef} args={[undefined, undefined, riboPts.length]} userData={{ organelle: 'ribosomes' }} material={mats.ribo}>
        <sphereGeometry args={[0.045, 8, 6]} />
      </instancedMesh>
      <instancedMesh ref={lysoRef} args={[undefined, undefined, LYSO_POSITIONS.length]} userData={{ organelle: 'lysosomes' }} material={mats.lyso}>
        <sphereGeometry args={[0.14, s(14), s(10)]} />
      </instancedMesh>

      {labelPos && (
        <Html position={labelPos} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-full bg-slate-900/85 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/30">
            {label(selected!)}
          </div>
        </Html>
      )}
    </group>
  );
}
