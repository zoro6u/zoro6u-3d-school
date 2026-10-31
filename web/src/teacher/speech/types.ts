export type SpeechLang = 'en' | 'ar';

export interface SpeakOptions {
  lang: SpeechLang;
  pitch?: number;
  rate?: number;
}

/**
 * Text-to-speech behind an interface so a paid, higher-quality provider can be dropped in later
 * (e.g. one that returns audio and exposes an AnalyserNode for true amplitude lip-sync).
 */
export interface SpeechProvider {
  readonly id: string;
  /** The browser can speak at all. */
  readonly supported: boolean;
  /** A voice for this language exists. Arabic voices are often missing in desktop browsers. */
  hasVoice(lang: SpeechLang): boolean;
  /** Queue text to be spoken. */
  speak(text: string, opts: SpeakOptions): void;
  cancel(): void;
  readonly speaking: boolean;
  /** Mouth openness 0–1 right now. The avatar calls this every frame. */
  getMouthLevel(nowMs: number): number;
  /** Providers that play audio themselves can expose real audio levels. The Web Speech API cannot. */
  getAnalyser?(): AnalyserNode | null;
  /** Subscribe to the voice list becoming available/changing. Returns an unsubscribe function. */
  onVoicesChanged?(cb: () => void): () => void;
}
