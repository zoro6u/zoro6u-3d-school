import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface LessonProgress {
  tourDone: boolean;
  /** Best quiz score so far, or null if the quiz hasn't been taken. */
  quizBest: number | null;
  quizTotal: number;
  quizAttempts: number;
}

export type LessonStatus = 'new' | 'started' | 'completed';

const MAX_ATTEMPTS = 9999;

/** localStorage is user-editable, so never trust it: keep only well-formed, in-range values. */
export function sanitizeProgress(raw: unknown): Record<string, LessonProgress> {
  const out: Record<string, LessonProgress> = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[a-z0-9-]{1,80}$/.test(id) || typeof v !== 'object' || v === null) continue;
    const p = v as Record<string, unknown>;
    const total = Number.isInteger(p.quizTotal) && (p.quizTotal as number) >= 1 && (p.quizTotal as number) <= 20 ? (p.quizTotal as number) : 3;
    const best = Number.isInteger(p.quizBest) && (p.quizBest as number) >= 0 && (p.quizBest as number) <= total ? (p.quizBest as number) : null;
    const attempts = Number.isInteger(p.quizAttempts) ? Math.min(Math.max(p.quizAttempts as number, 0), MAX_ATTEMPTS) : 0;
    out[id] = { tourDone: p.tourDone === true, quizBest: best, quizTotal: total, quizAttempts: best === null ? 0 : Math.max(attempts, 1) };
  }
  return out;
}

/** A lab is "completed" once its quiz is passed; "started" once the tour is done or the quiz attempted. */
export function lessonStatus(p: LessonProgress | undefined, passMark: number): LessonStatus {
  if (!p) return 'new';
  if (p.quizBest !== null && p.quizBest >= passMark) return 'completed';
  return p.tourDone || p.quizBest !== null ? 'started' : 'new';
}

interface ProgressState {
  lessons: Record<string, LessonProgress>;
  markTourDone: (lessonId: string) => void;
  recordQuiz: (lessonId: string, score: number, total: number) => void;
  reset: () => void;
}

const blank = (): LessonProgress => ({ tourDone: false, quizBest: null, quizTotal: 3, quizAttempts: 0 });

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      lessons: {},
      markTourDone: (id) => set((s) => ({ lessons: { ...s.lessons, [id]: { ...(s.lessons[id] ?? blank()), tourDone: true } } })),
      recordQuiz: (id, score, total) =>
        set((s) => {
          const cur = s.lessons[id] ?? blank();
          const best = cur.quizBest === null ? score : Math.max(cur.quizBest, score);
          return { lessons: { ...s.lessons, [id]: { ...cur, quizBest: best, quizTotal: total, quizAttempts: cur.quizAttempts + 1 } } };
        }),
      reset: () => set({ lessons: {} }),
    }),
    {
      name: '3dschool.progress',
      version: 1,
      partialize: (s) => ({ lessons: s.lessons }),
      merge: (persisted, current) => ({ ...current, lessons: sanitizeProgress((persisted as { lessons?: unknown } | undefined)?.lessons) }),
    },
  ),
);
