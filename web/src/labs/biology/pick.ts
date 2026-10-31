import type { OrganelleId } from './config';

/**
 * A click ray passes through translucent shells (membrane, cytoplasm) before reaching organelles.
 * Given ids of everything hit, nearest first, choose what the user meant:
 * an organelle if the ray hits one; otherwise the cytoplasm if the ray entered the cell;
 * otherwise the membrane (the thin rim, hit only by grazing rays).
 */
export function resolvePick(ids: OrganelleId[]): OrganelleId | null {
  const inner = ids.find((id) => id !== 'membrane' && id !== 'cytoplasm');
  if (inner) return inner;
  if (ids.includes('cytoplasm')) return 'cytoplasm';
  if (ids.includes('membrane')) return 'membrane';
  return null;
}

/** The cutaway removes the wedge x > 0 and z > 0 (the quarter facing the default camera). */
export function inCutaway(p: readonly [number, number, number]): boolean {
  return p[0] > 0 && p[2] > 0;
}
