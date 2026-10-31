import script from '../../../content/demo/teacher-script.json';
import { lessonRaws, lessons } from '../core/lessons';
import type { ChatRequest } from '../teacher/chatClient';
import type { ChatEvent } from '../teacher/sse';
import { validateToolCall } from '../teacher/tools';

interface Script {
  keywords: string[];
  call: { tool: string; args: Record<string, unknown> };
  texts: Record<string, [string, string, string]>;
}
const scripts = script.scripts as unknown as Record<string, Script[]>;
const defaults = script.default as unknown as Record<string, [string, string, string]>;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('aborted', 'AbortError'));
    });
  });

async function* say(text: string, signal?: AbortSignal): AsyncGenerator<ChatEvent> {
  for (const w of text.match(/\S+\s*/g) ?? []) {
    yield { event: 'text', data: { text: w } };
    await sleep(22, signal);
  }
}

/**
 * Scripted stand-in for the AI teacher: the same replies the dev mock LLM uses (content/demo/teacher-script.json),
 * streamed with the same event protocol, so the whole chat → speech → scene-action path runs with no server.
 */
export async function* demoStream(req: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatEvent> {
  const lesson = lessons.find((l) => l.id === req.lesson_id);
  const raw = lessonRaws[req.lesson_id];
  const lang = req.lang;
  const socratic = req.mode === 'socratic';
  const said = (req.messages.at(-1)?.content ?? '').toLowerCase();
  const match = (scripts[lesson?.subject ?? ''] ?? []).find((s) => s.keywords.some((k) => said.includes(k.toLowerCase())));

  if (!match || !raw) {
    const [, body, question] = defaults[lang]!;
    const params = (req.scene_state?.params ?? {}) as Record<string, unknown>;
    const seen = lang === 'en' && req.scene_state?.experiment === 'pendulum' && typeof params.start_angle_deg === 'number' ? `I can see a pendulum starting at ${params.start_angle_deg} degrees. ` : '';
    yield* say(seen + (socratic ? question : body), signal);
    yield { event: 'done', data: { stop_reason: 'end_turn' } };
    return;
  }

  const [intro, followup, socraticFollowup] = match.texts[lang]!;
  yield* say(intro, signal);
  const check = validateToolCall(raw, match.call.tool, match.call.args); // like the server: only valid calls become actions
  if (check.ok && check.action) yield { event: 'action', data: check.action };
  yield { event: 'text', data: { text: ' ' } };
  yield* say(check.ok && socratic ? socraticFollowup : followup, signal);
  yield { event: 'done', data: { stop_reason: 'end_turn' } };
}
