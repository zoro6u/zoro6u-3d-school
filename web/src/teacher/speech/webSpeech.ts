import { mouthLevel } from './level';
import type { SpeakOptions, SpeechLang, SpeechProvider } from './types';

const LOCALE: Record<SpeechLang, string> = { en: 'en-US', ar: 'ar-SA' };

/** Free default: the browser's built-in voices. Quality, and Arabic availability, vary by browser and OS. */
export class WebSpeechProvider implements SpeechProvider {
  readonly id = 'web-speech';
  private pending = 0;
  private lastBoundary = -1e9;
  private readonly synth: SpeechSynthesis | null;

  constructor(synth: SpeechSynthesis | null = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null) {
    this.synth = synth;
  }

  get supported(): boolean {
    return this.synth !== null && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  get speaking(): boolean {
    return this.pending > 0;
  }

  private voiceFor(lang: SpeechLang): SpeechSynthesisVoice | undefined {
    const voices = this.synth?.getVoices() ?? [];
    const matches = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(lang));
    return matches.find((v) => v.localService) ?? matches[0];
  }

  hasVoice(lang: SpeechLang): boolean {
    return this.supported && this.voiceFor(lang) !== undefined;
  }

  speak(text: string, opts: SpeakOptions): void {
    if (!this.supported || !this.synth || !text.trim()) return;
    const u = new SpeechSynthesisUtterance(text);
    const voice = this.voiceFor(opts.lang);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? LOCALE[opts.lang];
    u.pitch = opts.pitch ?? 1;
    u.rate = opts.rate ?? 1;
    u.onboundary = () => {
      this.lastBoundary = performance.now();
    };
    const done = () => {
      this.pending = Math.max(0, this.pending - 1);
    };
    u.onend = done;
    u.onerror = done;
    this.pending++;
    this.synth.speak(u);
  }

  cancel(): void {
    this.pending = 0;
    this.synth?.cancel();
  }

  getMouthLevel(nowMs: number): number {
    return mouthLevel(this.speaking, nowMs, this.lastBoundary);
  }

  onVoicesChanged(cb: () => void): () => void {
    if (!this.synth) return () => undefined;
    this.synth.addEventListener('voiceschanged', cb);
    return () => this.synth?.removeEventListener('voiceschanged', cb);
  }
}

let provider: SpeechProvider | null = null;

/** The active speech provider. Swap it with setSpeechProvider() to use a paid TTS service. */
export function getSpeech(): SpeechProvider {
  provider ??= new WebSpeechProvider();
  return provider;
}
export function setSpeechProvider(p: SpeechProvider): void {
  provider?.cancel();
  provider = p;
}
