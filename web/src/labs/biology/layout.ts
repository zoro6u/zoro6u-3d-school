// Procedural, deterministic layout of the cell interior. Pure data: no Three.js, so it is unit-testable.
import { CELL_RADIUS, type OrganelleId } from './config';

export type Vec3 = [number, number, number];
export type Detail = 'high' | 'low';

/** Small seeded PRNG so the cell looks identical on every load. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Keep a point inside the smooth-ER bounding sphere (minus the tube radius). */
function clampToBlob(p: Vec3): Vec3 {
  const lim = SER_RADIUS - 0.07;
  const dx = p[0] - SER_CENTER[0];
  const dy = p[1] - SER_CENTER[1];
  const dz = p[2] - SER_CENTER[2];
  const d = Math.hypot(dx, dy, dz);
  if (d <= lim) return p;
  const k = lim / d;
  return [SER_CENTER[0] + dx * k, SER_CENTER[1] + dy * k, SER_CENTER[2] + dz * k];
}

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export interface ErShell {
  radius: number;
  phiStart: number;
  phiLength: number;
  thetaStart: number;
  thetaLength: number;
}

export const NUCLEUS = { center: [0.2, 0.1, 0] as Vec3, radius: 0.95 };
/** Rough ER: curved sheets wrapped around the back of the nucleus (continuous with its envelope in real cells). */
export const ER_SHELLS: ErShell[] = [
  { radius: 1.18, phiStart: 3.4, phiLength: 2.4, thetaStart: 0.7, thetaLength: 1.5 },
  { radius: 1.32, phiStart: 3.7, phiLength: 2.2, thetaStart: 0.9, thetaLength: 1.3 },
  { radius: 1.46, phiStart: 3.2, phiLength: 2.6, thetaStart: 0.6, thetaLength: 1.6 },
];
export const GOLGI = { center: [-1.7, 0.9, 0.7] as Vec3, discs: 5, spacing: 0.15, radius: 0.6 };
export const SER_CENTER: Vec3 = [-1.0, -0.4, -1.7];
const SER_RADIUS = 0.6;
export const MITO_POSITIONS: Vec3[] = [
  [1.6, -0.9, 0.8], [1.9, 0.9, -0.6], [-0.4, 1.7, 1.0], [0.4, -1.7, -0.7], [-1.0, -1.2, 1.2],
];
export const LYSO_POSITIONS: Vec3[] = [
  [0.9, 1.0, 1.7], [-2.0, -0.9, 0.5], [1.9, 0.3, 0.3], [0.6, -0.8, 1.7], [0.9, -0.5, -2.1], [0.0, 2.0, -0.8], [-1.6, 1.9, -0.3],
];

/** Same parametrisation as THREE.SphereGeometry, so ribosomes sit exactly on the ER sheets. */
function shellPoint(c: Vec3, s: ErShell, u: number, v: number, lift: number): Vec3 {
  const phi = s.phiStart + u * s.phiLength;
  const theta = s.thetaStart + v * s.thetaLength;
  const r = s.radius + lift;
  return [c[0] - r * Math.cos(phi) * Math.sin(theta), c[1] + r * Math.cos(theta), c[2] + r * Math.sin(phi) * Math.sin(theta)];
}

export interface Blob {
  id: OrganelleId;
  center: Vec3;
  radius: number;
}

/** Bounding spheres of the non-sheet organelles; used to keep free ribosomes out of other organelles. */
export const BLOBS: Blob[] = [
  { id: 'nucleus', center: NUCLEUS.center, radius: NUCLEUS.radius },
  { id: 'golgi', center: GOLGI.center, radius: 0.7 },
  { id: 'smoothEr', center: SER_CENTER, radius: SER_RADIUS },
  ...MITO_POSITIONS.map((center): Blob => ({ id: 'mitochondria', center, radius: 0.42 })),
  ...LYSO_POSITIONS.map((center): Blob => ({ id: 'lysosomes', center, radius: 0.17 })),
];

export interface CellLayout {
  /** Ribosomes attached to the rough ER. */
  erRibosomes: Vec3[];
  /** Ribosomes floating in the cytoplasm. */
  freeRibosomes: Vec3[];
  /** Smooth-ER tube centre lines. */
  serTubes: Vec3[][];
  /** Where the camera looks for each selectable item. */
  focus: Record<OrganelleId, Vec3>;
}

export function buildLayout(detail: Detail = 'high'): CellLayout {
  const rand = mulberry32(20240607);
  const nErRibo = detail === 'high' ? 130 : 55;
  const nFree = detail === 'high' ? 110 : 45;

  const erRibosomes: Vec3[] = [];
  for (let i = 0; i < nErRibo; i++) {
    const s = ER_SHELLS[i % ER_SHELLS.length]!;
    erRibosomes.push(shellPoint(NUCLEUS.center, s, 0.04 + rand() * 0.92, 0.04 + rand() * 0.92, 0.035));
  }

  const freeRibosomes: Vec3[] = [];
  let guard = 0;
  while (freeRibosomes.length < nFree && guard++ < 20000) {
    const p: Vec3 = [(rand() * 2 - 1) * 2.6, (rand() * 2 - 1) * 2.6, (rand() * 2 - 1) * 2.6];
    if (Math.hypot(...p) > CELL_RADIUS - 0.45) continue;
    if (dist(p, NUCLEUS.center) < 1.75) continue; // keep clear of nucleus + ER sheets
    if (BLOBS.some((b) => dist(p, b.center) < b.radius + 0.1)) continue;
    freeRibosomes.push(p);
  }

  const serTubes: Vec3[][] = [];
  for (let t = 0; t < 5; t++) {
    const pts: Vec3[] = [];
    let p: Vec3 = [SER_CENTER[0] + (rand() - 0.5) * 0.9, SER_CENTER[1] + (rand() - 0.5) * 0.9, SER_CENTER[2] + (rand() - 0.5) * 0.9];
    for (let k = 0; k < 6; k++) {
      pts.push(clampToBlob(p));
      p = [p[0] + (rand() - 0.5) * 0.55, p[1] + (rand() - 0.5) * 0.55, p[2] + (rand() - 0.5) * 0.55];
      // pull back toward the centre so the network stays compact
      p = [p[0] + (SER_CENTER[0] - p[0]) * 0.25, p[1] + (SER_CENTER[1] - p[1]) * 0.25, p[2] + (SER_CENTER[2] - p[2]) * 0.25];
    }
    serTubes.push(pts);
  }

  const centroid = (ps: Vec3[]): Vec3 => [
    ps.reduce((a, p) => a + p[0], 0) / ps.length,
    ps.reduce((a, p) => a + p[1], 0) / ps.length,
    ps.reduce((a, p) => a + p[2], 0) / ps.length,
  ];

  return {
    erRibosomes,
    freeRibosomes,
    serTubes,
    focus: {
      nucleus: NUCLEUS.center,
      mitochondria: MITO_POSITIONS[0]!,
      ribosomes: centroid(erRibosomes),
      roughEr: centroid(erRibosomes),
      smoothEr: SER_CENTER,
      golgi: GOLGI.center,
      lysosomes: LYSO_POSITIONS[0]!,
      membrane: [0, 0, 0],
      cytoplasm: [0.9, -0.2, 0.8],
    },
  };
}
