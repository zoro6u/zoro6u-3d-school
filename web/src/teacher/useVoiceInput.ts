import { useCallback, useEffect, useRef, useState } from 'react';

// SpeechRecognition isn't in lib.dom for all browsers; this is the small slice we use.
interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Optional voice input (Chromium and Safari only; Firefox has none). Audio is sent to the browser vendor's
 * speech service, which is why it is opt-in via the microphone button.
 */
export function useVoiceInput(lang: 'en' | 'ar', onFinal: (text: string) => void) {
  const supported = ctor() !== null;
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const cb = useRef(onFinal);
  cb.current = onFinal;

  useEffect(() => () => rec.current?.abort(), []);

  const toggle = useCallback(() => {
    const C = ctor();
    if (!C) return;
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = new C();
    r.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      const text = last?.[0]?.transcript?.trim();
      if (text) cb.current(text);
    };
    r.onerror = (e) => setError(e.error);
    r.onend = () => setListening(false);
    setError(null);
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [lang, listening]);

  return { supported, listening, error, toggle };
}
