import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Lang = 'en' | 'ar';

export interface SettingsState {
  lang: Lang;
  lowGraphics: boolean;
  reducedMotion: boolean;
  /** Teacher speaks replies aloud (captions are always shown). */
  teacherVoice: boolean;
  setLang: (lang: Lang) => void;
  setLowGraphics: (v: boolean) => void;
  setReducedMotion: (v: boolean) => void;
  setTeacherVoice: (v: boolean) => void;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const initialLang = (): Lang =>
  typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ar') ? 'ar' : 'en';

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      lang: initialLang(),
      lowGraphics: false,
      reducedMotion: prefersReducedMotion(),
      teacherVoice: true,
      setLang: (lang) => set({ lang }),
      setLowGraphics: (lowGraphics) => set({ lowGraphics }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setTeacherVoice: (teacherVoice) => set({ teacherVoice }),
    }),
    { name: '3dschool.settings', version: 1 },
  ),
);

export const dirFor = (lang: Lang): 'rtl' | 'ltr' => (lang === 'ar' ? 'rtl' : 'ltr');
