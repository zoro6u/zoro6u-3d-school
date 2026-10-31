import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import type { Subject } from '../core/lessons';
import type { TeacherAction } from './tools';

export interface ActionResult {
  ok: boolean;
  /** Short human-readable description shown as a chip, e.g. "Gravity → Moon". */
  label: string;
}

/**
 * What every lab exposes to the teacher (and to scripted tours): a JSON snapshot of the scene and a way to
 * perform validated actions. The teacher layer never touches lab internals.
 */
export interface SceneAdapter {
  lab: Subject;
  getState(): Record<string, unknown>;
  apply(action: TeacherAction): ActionResult;
}

interface SceneStore {
  adapter: SceneAdapter | null;
  set(a: SceneAdapter): void;
  clear(a: SceneAdapter): void;
}

export const useScene = create<SceneStore>((set, get) => ({
  adapter: null,
  set: (adapter) => set({ adapter }),
  clear: (a) => {
    if (get().adapter === a) set({ adapter: null });
  },
}));

/**
 * Register a lab's adapter while it is mounted. Pass functions that read the lab's *current* state from refs;
 * the adapter object itself is created once.
 */
export function useRegisterScene(lab: Subject, impl: { getState: SceneAdapter['getState']; apply: SceneAdapter['apply'] }): void {
  const ref = useRef(impl);
  ref.current = impl;
  useEffect(() => {
    const adapter: SceneAdapter = { lab, getState: () => ref.current.getState(), apply: (a) => ref.current.apply(a) };
    useScene.getState().set(adapter);
    return () => useScene.getState().clear(adapter);
  }, [lab]);
}
