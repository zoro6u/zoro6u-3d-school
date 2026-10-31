import type { ActionResult } from './scene';
import type { TeacherAction } from './tools';

export type TourStatus = 'idle' | 'playing' | 'paused' | 'finished';

export interface TourState {
  status: TourStatus;
  index: number;
  total: number;
  text: string;
  chips: ActionResult[];
}

export interface TourDeps {
  total: number;
  text(index: number): string;
  actions(index: number): TeacherAction[];
  apply(action: TeacherAction): ActionResult;
  speak(text: string): void;
  cancelSpeech(): void;
  isSpeaking(): boolean;
  voiceEnabled(): boolean;
  onState(state: TourState): void;
  onFinished(): void;
}

const ACTION_GAP_MS = 250; // lets React re-render between dependent actions (e.g. switch reaction, then jump to a step)
const POLL_MS = 150;
const STEP_GAP_MS = 700;

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
/** Time a student needs to read (and watch the scene change) when nothing is being spoken. */
export const readingMs = (text: string) => Math.max(5000, wordCount(text) * 380);

/**
 * Runs a scripted tour: for each step it performs the scene actions, shows the caption, speaks it if voice is on,
 * waits for the speech (or a reading-time floor) and moves on. Works with no network and no API key.
 * Pause/Next/Previous give step-by-step control; while paused, stepping shows each step without auto-advancing.
 */
export class TourRunner {
  state: TourState;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private poll: ReturnType<typeof setInterval> | null = null;
  private token = 0;

  constructor(private readonly d: TourDeps) {
    this.state = { status: 'idle', index: 0, total: d.total, text: '', chips: [] };
  }

  start(index = 0): void {
    this.enter(index, 'playing');
  }
  pause(): void {
    if (this.state.status !== 'playing') return;
    this.halt();
    this.d.cancelSpeech();
    this.set({ status: 'paused' });
  }
  resume(): void {
    if (this.state.status === 'paused') this.enter(this.state.index, 'playing');
  }
  next(): void {
    if (this.state.status === 'idle' || this.state.status === 'finished') return;
    if (this.state.index >= this.state.total - 1) return this.finish();
    this.enter(this.state.index + 1, this.state.status);
  }
  prev(): void {
    if (this.state.status === 'idle') return;
    if (this.state.status === 'finished') return this.enter(this.state.total - 1, 'paused');
    this.enter(Math.max(0, this.state.index - 1), this.state.status);
  }
  stop(): void {
    this.halt();
    this.d.cancelSpeech();
    this.set({ status: 'idle', index: 0, text: '', chips: [] });
  }
  /** Re-render the caption (e.g. after a language switch) without restarting the step. */
  refresh(): void {
    if (this.state.status !== 'idle' && this.state.status !== 'finished') this.set({ text: this.d.text(this.state.index) });
  }

  // ---- internals -----------------------------------------------------------------
  private set(patch: Partial<TourState>): void {
    this.state = { ...this.state, ...patch };
    this.d.onState(this.state);
  }

  private halt(): void {
    this.token++;
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
  }

  private later(ms: number, fn: () => void): void {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  }

  private enter(index: number, status: 'playing' | 'paused'): void {
    this.halt();
    this.d.cancelSpeech();
    const token = this.token;
    const text = this.d.text(index);
    this.set({ status, index, text, chips: [] });

    // actions, one after another
    const actions = this.d.actions(index);
    actions.forEach((a, i) =>
      this.later(i * ACTION_GAP_MS, () => {
        if (token !== this.token) return;
        const res = this.d.apply(a);
        this.set({ chips: [...this.state.chips, res] });
      }),
    );

    if (status !== 'playing') return; // stepping manually: no narration, no auto-advance
    const speaking = this.d.voiceEnabled();
    if (speaking) this.d.speak(text);

    const started = Date.now();
    const floor = speaking ? 1500 : readingMs(text);
    const ceiling = readingMs(text) * 2 + 4000; // never hang if a speech engine never reports "finished"
    this.poll = setInterval(() => {
      if (token !== this.token) return;
      const elapsed = Date.now() - started;
      const speechDone = !speaking || !this.d.isSpeaking();
      if ((elapsed >= floor && speechDone && elapsed >= actions.length * ACTION_GAP_MS) || elapsed >= ceiling) {
        if (this.poll) clearInterval(this.poll);
        this.poll = null;
        this.later(STEP_GAP_MS, () => {
          if (token !== this.token) return;
          if (index >= this.state.total - 1) this.finish();
          else this.enter(index + 1, 'playing');
        });
      }
    }, POLL_MS);
  }

  private finish(): void {
    this.halt();
    this.d.cancelSpeech();
    this.set({ status: 'finished' });
    this.d.onFinished();
  }
}
