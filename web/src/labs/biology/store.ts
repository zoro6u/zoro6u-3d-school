import { create } from 'zustand';
import type { OrganelleId } from './config';

/**
 * Lab state lives in a store (not component state) so that other parts of the app —
 * the AI teacher and scripted tours in later phases — can read and drive the same scene.
 */
export interface BiologyState {
  selected: OrganelleId | null;
  cutaway: boolean;
  /** Bumped to request a camera reset even if nothing else changed. */
  resetNonce: number;
  select: (id: OrganelleId | null) => void;
  setCutaway: (v: boolean) => void;
  resetView: () => void;
}

export const useBiology = create<BiologyState>((set) => ({
  selected: null,
  cutaway: false,
  resetNonce: 0,
  select: (selected) => set({ selected }),
  setCutaway: (cutaway) => set({ cutaway }),
  resetView: () => set((s) => ({ selected: null, resetNonce: s.resetNonce + 1 })),
}));

/** JSON snapshot of the scene, as it will be sent to the AI teacher. */
export function biologySceneState(s: Pick<BiologyState, 'selected' | 'cutaway'>) {
  return { lab: 'biology', selected_organelle: s.selected, cutaway: s.cutaway };
}
