import { create } from 'zustand';
import type { LessonMeta } from '../core/lessons';
import { lessonRaws } from '../core/lessons';
import { teacherById } from '../core/teachers';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';
import { chipLabel } from './chips';
import { useScene } from './scene';
import { splitSentences } from './sentences';
import { getSpeech } from './speech/webSpeech';
import { TourRunner, type TourState } from './tour';
import { stepActions, tours } from './tourData';

const IDLE: TourState = { status: 'idle', index: 0, total: 0, text: '', chips: [] };

interface TourStore {
  state: TourState;
  lessonId: string | null;
  start: (lesson: LessonMeta) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
}

let runner: TourRunner | null = null;
let unsubLang: (() => void) | null = null;

/** Replaceable for tests. */
export const tourDeps = { getSpeech };

export const useTour = create<TourStore>((set) => ({
  state: IDLE,
  lessonId: null,

  start: (lesson) => {
    const tour = tours[lesson.id];
    const raw = lessonRaws[lesson.id];
    if (!tour || !raw) return;
    runner?.stop();
    unsubLang?.();
    const teacher = teacherById(lesson.teacher);
    const speech = () => tourDeps.getSpeech();
    runner = new TourRunner({
      total: tour.def.steps.length,
      text: (i) => tour.text[useSettings.getState().lang].steps[tour.def.steps[i]!.id] ?? '',
      actions: (i) => stepActions(tour, raw, i),
      apply: (a) => useScene.getState().adapter?.apply(a) ?? { ok: false, label: chipLabel(a) },
      speak: (text) => {
        const { lang } = useSettings.getState();
        splitSentences(text, true).sentences.forEach((s) => speech().speak(s, { lang, pitch: teacher?.voice.pitch, rate: teacher?.voice.rate }));
      },
      cancelSpeech: () => speech().cancel(),
      isSpeaking: () => speech().speaking,
      voiceEnabled: () => {
        const { lang, teacherVoice } = useSettings.getState();
        return teacherVoice && speech().supported && speech().hasVoice(lang);
      },
      onState: (state) => set({ state }),
      onFinished: () => useProgress.getState().markTourDone(lesson.id),
    });
    unsubLang = useSettings.subscribe((s, prev) => {
      if (s.lang !== prev.lang) runner?.refresh();
    });
    set({ lessonId: lesson.id });
    runner.start(0);
  },
  pause: () => runner?.pause(),
  resume: () => runner?.resume(),
  next: () => runner?.next(),
  prev: () => runner?.prev(),
  stop: () => {
    runner?.stop();
    unsubLang?.();
    unsubLang = null;
    runner = null;
    set({ state: IDLE, lessonId: null });
  },
}));
