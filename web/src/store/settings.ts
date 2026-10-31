import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { defaultLowGraphics } from '../core/quality';

export type Lang = 'en' | 'ar';

export interface SettingsState {
  lang: Lang;
  lowGraphics: boolean;
  reducedMotion: boolean;
  /** Teacher speaks replies aloud (captions are always shown). */
  teacherVoice: boolean;
  /** True after the app switched itself to low graphics because the frame rate was poor (session only). */
  autoDegraded: boolean;
  setLang: (lang: Lang) => void;
  setLowGraphics: (v: boolean) => void;
  setReducedMotion: (v: boolean) => void;
  setTeacherVoice: (v: boolean) => void;
  degradeGraphics: () => void;
  dismissAutoDegraded: () => void;
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
      lowGraphics: defaultLowGraphics(),
      reducedMotion: prefersReducedMotion(),
      teacherVoice: true,
      autoDegraded: false,
      setLang: (lang) => set({ lang }),
      setLowGraphics: (lowGraphics) => set({ lowGraphics }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setTeacherVoice: (teacherVoice) => set({ teacherVoice }),
      degradeGraphics: () => set({ lowGraphics: true, autoDegraded: true }),
      dismissAutoDegraded: () => set({ autoDegraded: false }),
    }),
    {
      name: '3dschool.settings',
      version: 1,
      partialize: ({ autoDegraded: _a, ...rest }) => rest as unknown as SettingsState,
    },
  ),
);

export const dirFor = (lang: Lang): 'rtl' | 'ltr' => (lang === 'ar' ? 'rtl' : 'ltr');
