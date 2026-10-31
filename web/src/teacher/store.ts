import { create } from 'zustand';
import type { LessonMeta } from '../core/lessons';
import { lessonRaws } from '../core/lessons';
import { teacherById } from '../core/teachers';
import { useSettings } from '../store/settings';
import { ChatHttpError, fetchHealth, streamChat, type ChatRequest } from './chatClient';
import { chipLabel } from './chips';
import { useScene } from './scene';
import { consumeChat } from './session';
import { getSpeech } from './speech/webSpeech';

export interface ActionChip {
  ok: boolean;
  label: string;
}
export interface TeacherMsg {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  actions: ActionChip[];
}
export type Availability = 'unknown' | 'online' | 'offline';

export interface TeacherState {
  open: boolean;
  messages: TeacherMsg[];
  status: 'idle' | 'streaming';
  mode: 'explain' | 'socratic';
  availability: Availability;
  /** i18n key (under teacher.errors) of the last problem, if any. */
  notice: string | null;
  noticeVars: Record<string, unknown>;
  setOpen: (v: boolean) => void;
  setMode: (m: 'explain' | 'socratic') => void;
  checkAvailability: () => Promise<void>;
  send: (text: string, lesson: LessonMeta) => Promise<void>;
  stop: () => void;
  clear: () => void;
}

let nextId = 1;
let controller: AbortController | null = null;

/** Replaceable for tests. */
export const deps = { streamChat, fetchHealth, getSpeech };

export const useTeacher = create<TeacherState>((set, get) => ({
  open: false,
  messages: [],
  status: 'idle',
  mode: 'explain',
  availability: 'unknown',
  notice: null,
  noticeVars: {},

  setOpen: (open) => set({ open }),
  setMode: (mode) => set({ mode }),

  checkAvailability: async () => {
    const h = await deps.fetchHealth();
    set({ availability: h?.llm ? 'online' : 'offline' });
  },

  stop: () => {
    controller?.abort();
    controller = null;
    deps.getSpeech().cancel();
    set({ status: 'idle' });
  },

  clear: () => {
    get().stop();
    set({ messages: [], notice: null });
  },

  send: async (raw, lesson) => {
    const text = raw.trim();
    if (!text || get().status === 'streaming') return;
    const { lang, teacherVoice } = useSettings.getState();
    const raws = lessonRaws[lesson.id] ?? {};
    const userMsg: TeacherMsg = { id: nextId++, role: 'user', text, actions: [] };
    const botMsg: TeacherMsg = { id: nextId++, role: 'assistant', text: '', actions: [] };
    const history = get()
      .messages.filter((m) => m.text)
      .map((m) => ({ role: m.role, content: m.text }));
    set((s) => ({ messages: [...s.messages, userMsg, botMsg], status: 'streaming', notice: null }));

    const patch = (fn: (m: TeacherMsg) => TeacherMsg) =>
      set((s) => ({ messages: s.messages.map((m) => (m.id === botMsg.id ? fn(m) : m)) }));

    const adapter = useScene.getState().adapter;
    const req: ChatRequest = {
      lesson_id: lesson.id,
      lang,
      mode: get().mode,
      messages: [...history, { role: 'user' as const, content: text }].slice(-24),
      scene_state: adapter?.getState() ?? null,
    };

    const speech = deps.getSpeech();
    const teacher = teacherById(lesson.teacher);
    const speakIt = teacherVoice && speech.supported && speech.hasVoice(lang);
    controller = new AbortController();
    const { signal } = controller;

    try {
      await consumeChat(deps.streamChat(req, signal), raws, {
        onText: (d) => patch((m) => ({ ...m, text: m.text + d })),
        onSentence: (s) => {
          if (speakIt) speech.speak(s, { lang, pitch: teacher?.voice.pitch, rate: teacher?.voice.rate });
        },
        onAction: (a) => {
          const res = useScene.getState().adapter?.apply(a) ?? { ok: false, label: chipLabel(a) };
          patch((m) => ({ ...m, actions: [...m.actions, res] }));
        },
        onError: (code) => {
          set({ notice: `teacher.errors.${['refusal', 'busy', 'network', 'llm_unavailable', 'truncated'].includes(code) ? code : 'generic'}` });
        },
        onDone: () => undefined,
      });
    } catch (e) {
      if (signal.aborted) return;
      if (e instanceof ChatHttpError) {
        if (e.status === 503) set({ availability: 'offline', notice: null });
        else if (e.code === 'rate_limited') set({ notice: 'teacher.errors.rate_limited', noticeVars: { seconds: e.retryAfter ?? 30 } });
        else if (e.code === 'message_too_long') set({ notice: 'teacher.errors.too_long' });
        else set({ notice: 'teacher.errors.generic' });
      } else {
        set({ notice: 'teacher.errors.network' });
      }
    } finally {
      // Drop an empty assistant bubble (error before any text); keep partial text if there is some.
      set((s) => ({ messages: s.messages.filter((m) => m.id !== botMsg.id || m.text || m.actions.length), status: 'idle' }));
      controller = null;
    }
  },
}));
