import { create } from 'zustand';

/** Which lesson's quiz dialog is open (null = closed). */
export const useQuizUI = create<{ openFor: string | null; open: (id: string) => void; close: () => void }>((set) => ({
  openFor: null,
  open: (openFor) => set({ openFor }),
  close: () => set({ openFor: null }),
}));
