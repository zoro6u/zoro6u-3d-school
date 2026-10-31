import type { ChatEvent } from './sse';
import { splitSentences } from './sentences';
import { validateAction, type TeacherAction } from './tools';

export interface TurnHandlers {
  /** Raw streamed text, for captions. */
  onText(delta: string): void;
  /** A complete sentence, ready to be spoken. */
  onSentence(sentence: string): void;
  /** A tool call that passed validation, ready to run against the scene. */
  onAction(action: TeacherAction): void;
  /** A tool call that failed client-side validation (should not happen if the server is healthy). */
  onRejected?(reason: string): void;
  onError(code: string, message: string): void;
  onDone(): void;
}

/**
 * Drives one teacher turn from a stream of chat events: captions, sentence-by-sentence speech and validated scene actions.
 * Pure logic with injected handlers so it can be tested without a browser.
 */
export async function consumeChat(events: AsyncIterable<ChatEvent>, lessonRaw: Record<string, unknown>, h: TurnHandlers): Promise<void> {
  let buffer = '';
  const speak = (flush: boolean) => {
    const { sentences, rest } = splitSentences(buffer, flush);
    buffer = rest;
    sentences.forEach((s) => h.onSentence(s));
  };
  for await (const ev of events) {
    if (ev.event === 'text') {
      h.onText(ev.data.text);
      buffer += ev.data.text;
      speak(false);
    } else if (ev.event === 'action') {
      const check = validateAction(lessonRaw, ev.data);
      if (check.ok && check.action) h.onAction(check.action);
      else h.onRejected?.(check.message);
    } else if (ev.event === 'error') {
      speak(true);
      h.onError(ev.data.code, ev.data.message);
      return;
    } else if (ev.event === 'done') {
      speak(true);
      h.onDone();
      return;
    }
  }
  speak(true);
  h.onDone();
}
