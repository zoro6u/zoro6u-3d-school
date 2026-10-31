import lesson from '../../../../content/lessons/biology-animal-cell/lesson.json';

export type OrganelleId =
  | 'nucleus' | 'mitochondria' | 'ribosomes' | 'roughEr' | 'smoothEr'
  | 'golgi' | 'lysosomes' | 'membrane' | 'cytoplasm';

export interface OrganelleSpec {
  id: OrganelleId;
  color: string;
  /** Camera distance when focusing this organelle. */
  focusDistance: number;
}

/** Names/functions are in the i18n files (biology.organelles.<id>.*); geometry, colours and framing are data. */
export const bioConfig = lesson.biology as { cellRadius: number; organelles: OrganelleSpec[] };
export const organelles = bioConfig.organelles;
export const organelleIds = organelles.map((o) => o.id);
export const CELL_RADIUS = bioConfig.cellRadius;

export function isOrganelleId(v: unknown): v is OrganelleId {
  return typeof v === 'string' && (organelleIds as string[]).includes(v);
}
export function specOf(id: OrganelleId): OrganelleSpec {
  return organelles.find((o) => o.id === id)!;
}
