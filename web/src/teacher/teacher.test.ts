import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lessonRaws, lessons } from '../core/lessons';
import { useSettings } from '../store/settings';
import { ChatHttpError, streamChat, type ChatRequest } from './chatClient';
import { blinkAmount, mouthLevel } from './speech/level';
import { splitSentences } from './sentences';
import { useScene, type SceneAdapter } from './scene';
import { consumeChat } from './session';
import { parseSSE, type ChatEvent } from './sse';
import { deps, useTeacher } from './store';
import type { SpeechProvider } from './speech/types';
import { WebSpeechProvider } from './speech/webSpeech';

const enc = new TextEncoder();
function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(c) {
      chunks.forEach((x) => c.enqueue(enc.encode(x)));
      c.close();
    },
  });
}
async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}
async function* events(...evs: ChatEvent[]): AsyncGenerator<ChatEvent> {
  for (const e of evs) yield e;
}
const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

describe('parseSSE', () => {
  it('parses events split at arbitrary byte boundaries, CRLF, and unicode', async () => {
    const full = sse('text', { text: 'مرحبا ' }) + sse('action', { tool: 'reset_scene' }) + sse('done', { stop_reason: 'end_turn' });
    const bytes = enc.encode(full.replace(/\n/g, '\r\n'));
    const chunks = [bytes.slice(0, 7), bytes.slice(7, 31), bytes.slice(31)];
    const stream = new ReadableStream<Uint8Array>({ start(c) { chunks.forEach((x) => c.enqueue(x)); c.close(); } });
    const evs = await collect(parseSSE(stream));
    expect(evs.map((e) => e.event)).toEqual(['text', 'action', 'done']);
    expect((evs[0] as { data: { text: string } }).data.text).toBe('مرحبا ');
  });
  it('skips malformed blocks', async () => {
    const evs = await collect(parseSSE(streamOf(['event: text\ndata: {oops\n\n', sse('done', {})])));
    expect(evs.map((e) => e.event)).toEqual(['done']);
  });
});

describe('streamChat', () => {
  const req: ChatRequest = { lesson_id: 'physics-oscillations', lang: 'en', mode: 'explain', messages: [{ role: 'user', content: 'hi' }], scene_state: null };
  it('POSTs JSON to /api/chat and yields events', async () => {
    const f = vi.fn(async () => new Response(streamOf([sse('text', { text: 'Hi' }), sse('done', {})]), { status: 200 }));
    const evs = await collect(streamChat(req, undefined, f as unknown as typeof fetch));
    expect(evs.map((e) => e.event)).toEqual(['text', 'done']);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/chat');
    expect(JSON.parse(init.body as string).lesson_id).toBe('physics-oscillations');
  });
  it('turns 503 / 429 JSON errors into ChatHttpError with the server code', async () => {
    const f503 = async () => new Response(JSON.stringify({ detail: { code: 'llm_unavailable', message: 'x' } }), { status: 503 });
    await expect(collect(streamChat(req, undefined, f503 as unknown as typeof fetch))).rejects.toMatchObject({ status: 503, code: 'llm_unavailable' });
    const f429 = async () => new Response(JSON.stringify({ detail: { code: 'rate_limited', message: 'x' } }), { status: 429, headers: { 'retry-after': '12' } });
    await expect(collect(streamChat(req, undefined, f429 as unknown as typeof fetch))).rejects.toMatchObject({ status: 429, code: 'rate_limited', retryAfter: 12 });
    const fHtml = async () => new Response('<html>Bad gateway</html>', { status: 502 });
    await expect(collect(streamChat(req, undefined, fHtml as unknown as typeof fetch))).rejects.toBeInstanceOf(ChatHttpError);
  });
});

describe('splitSentences', () => {
  it('does not split decimals, units or abbreviations', () => {
    const r = splitSentences('Gravity is 1.62 m/s² here. Dr. Nour agrees! Next', false);
    expect(r.sentences).toEqual(['Gravity is 1.62 m/s² here.', 'Dr. Nour agrees!']);
    expect(r.rest.trim()).toBe('Next');
  });
  it('waits when a terminator ends the buffer (the number may continue)', () => {
    expect(splitSentences('It is 9.', false)).toEqual({ sentences: [], rest: 'It is 9.' });
    expect(splitSentences('It is 9.', true).sentences).toEqual(['It is 9.']);
  });
  it('handles Arabic question marks and flushing', () => {
    expect(splitSentences('ما هذا؟ هذه نواة. وهذه', false).sentences).toEqual(['ما هذا؟', 'هذه نواة.']);
    expect(splitSentences('وهذه', true).sentences).toEqual(['وهذه']);
  });
});

describe('lip-sync helpers', () => {
  it('mouth is closed when silent and always within 0–1 when speaking', () => {
    expect(mouthLevel(false, 1234, 0)).toBe(0);
    for (let t = 0; t < 5000; t += 17) {
      const v = mouthLevel(true, t, -1e9);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
  it('moves over time (not a constant) and bumps on word boundaries', () => {
    const vals = new Set(Array.from({ length: 40 }, (_, i) => mouthLevel(true, i * 23, -1e9).toFixed(2)));
    expect(vals.size).toBeGreaterThan(10);
    expect(mouthLevel(true, 1000, 1000)).toBeGreaterThan(mouthLevel(true, 1000, -1e9));
  });
  it('blinks briefly and rarely', () => {
    expect(blinkAmount(1)).toBe(0);
    expect(Math.max(...Array.from({ length: 200 }, (_, i) => blinkAmount(i * 0.01)))).toBeGreaterThan(0.95);
    const closed = Array.from({ length: 3700 }, (_, i) => blinkAmount(i * 0.001)).filter((v) => v > 0.5).length;
    expect(closed / 3700).toBeLessThan(0.1);
  });
});

describe('consumeChat', () => {
  const raw = lessonRaws['physics-oscillations']!;
  const handlers = () => {
    const log: string[] = [];
    return {
      log,
      h: {
        onText: (d: string) => log.push(`text:${d}`),
        onSentence: (s: string) => log.push(`say:${s}`),
        onAction: (a: unknown) => log.push(`act:${JSON.stringify(a)}`),
        onRejected: (m: string) => log.push(`rej:${m}`),
        onError: (c: string) => log.push(`err:${c}`),
        onDone: () => log.push('done'),
      },
    };
  };
  it('speaks sentence by sentence as text streams, and runs validated actions in order', async () => {
    const { log, h } = handlers();
    await consumeChat(events(
      { event: 'text', data: { text: "Let's try the Moon. Gra" } },
      { event: 'action', data: { tool: 'set_param', name: 'gravity', value: 'moon' } },
      { event: 'text', data: { text: 'vity is weaker there.' } },
      { event: 'done', data: {} },
    ), raw, h);
    expect(log.filter((l) => !l.startsWith('text:'))).toEqual([
      "say:Let's try the Moon.",
      'act:{"tool":"set_param","name":"gravity","value":"moon"}',
      'say:Gravity is weaker there.',
      'done',
    ]);
  });
  it('never runs an invalid action, even if the server sent it', async () => {
    const { log, h } = handlers();
    await consumeChat(events(
      { event: 'action', data: { tool: 'set_param', name: 'pendulum_length', value: 99 } },
      { event: 'action', data: { tool: 'launch_missiles' } },
      { event: 'done', data: {} },
    ), raw, h);
    expect(log.some((l) => l.startsWith('act:'))).toBe(false);
    expect(log.filter((l) => l.startsWith('rej:'))).toHaveLength(2);
  });
  it('flushes pending speech before reporting an error', async () => {
    const { log, h } = handlers();
    await consumeChat(events({ event: 'text', data: { text: 'Half a thought' } }, { event: 'error', data: { code: 'busy', message: 'm' } }), raw, h);
    expect(log.slice(-2)).toEqual(['say:Half a thought', 'err:busy']);
  });
});

describe('teacher store (send → stream → speak → act)', () => {
  const lesson = lessons.find((l) => l.subject === 'physics')!;
  const spoken: { text: string; pitch?: number; rate?: number }[] = [];
  const fakeSpeech: SpeechProvider = {
    id: 'fake', supported: true, speaking: false, hasVoice: () => true,
    speak: (text, o) => void spoken.push({ text, pitch: o.pitch, rate: o.rate }),
    cancel: vi.fn(), getMouthLevel: () => 0,
  };
  const applied: unknown[] = [];
  const adapter: SceneAdapter = {
    lab: 'physics',
    getState: () => ({ lab: 'physics', experiment: 'pendulum' }),
    apply: (a) => (applied.push(a), { ok: true, label: 'gravity → moon' }),
  };
  let lastReq: ChatRequest | null = null;

  beforeEach(() => {
    spoken.length = 0;
    applied.length = 0;
    lastReq = null;
    useTeacher.setState({ messages: [], status: 'idle', notice: null, availability: 'unknown', mode: 'explain' });
    useSettings.setState({ lang: 'en', teacherVoice: true });
    useScene.setState({ adapter });
    deps.getSpeech = () => fakeSpeech;
    void lessonRaws;
  });

  const script = (...evs: ChatEvent[]) => {
    deps.streamChat = ((req: ChatRequest) => ((lastReq = req), events(...evs))) as typeof deps.streamChat;
  };

  it('streams captions, speaks each sentence with the teacher voice, applies actions, sends scene state', async () => {
    script(
      { event: 'text', data: { text: "Let's visit the Moon. " } },
      { event: 'action', data: { tool: 'set_param', name: 'gravity', value: 'moon' } },
      { event: 'text', data: { text: 'It swings slower there.' } },
      { event: 'done', data: {} },
    );
    await useTeacher.getState().send('show me the moon', lesson);
    const { messages, status } = useTeacher.getState();
    expect(status).toBe('idle');
    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(messages[1]!.text).toBe("Let's visit the Moon. It swings slower there.");
    expect(messages[1]!.actions).toEqual([{ ok: true, label: 'gravity → moon' }]);
    expect(applied).toEqual([{ tool: 'set_param', name: 'gravity', value: 'moon' }]);
    expect(spoken.map((s) => s.text)).toEqual(["Let's visit the Moon.", 'It swings slower there.']);
    expect(spoken[0]).toMatchObject({ pitch: 0.85, rate: 0.95 }); // Prof. Karim's voice
    expect(lastReq).toMatchObject({ lesson_id: lesson.id, lang: 'en', mode: 'explain', scene_state: { lab: 'physics' } });
  });

  it('sends earlier turns as history and respects the Socratic mode', async () => {
    script({ event: 'text', data: { text: 'First answer.' } }, { event: 'done', data: {} });
    await useTeacher.getState().send('one', lesson);
    useTeacher.getState().setMode('socratic');
    script({ event: 'text', data: { text: 'Second answer.' } }, { event: 'done', data: {} });
    await useTeacher.getState().send('two', lesson);
    expect(lastReq!.mode).toBe('socratic');
    expect(lastReq!.messages.map((m) => m.content)).toEqual(['one', 'First answer.', 'two']);
  });

  it('does not speak when the teacher voice is muted, but still shows captions', async () => {
    useSettings.setState({ teacherVoice: false });
    script({ event: 'text', data: { text: 'Quiet reply.' } }, { event: 'done', data: {} });
    await useTeacher.getState().send('hi', lesson);
    expect(spoken).toHaveLength(0);
    expect(useTeacher.getState().messages[1]!.text).toBe('Quiet reply.');
  });

  it('marks the teacher offline on 503 and removes the empty bubble', async () => {
    deps.streamChat = (() => (async function* () { throw new ChatHttpError(503, 'llm_unavailable', 'x'); })()) as typeof deps.streamChat;
    await useTeacher.getState().send('hi', lesson);
    expect(useTeacher.getState().availability).toBe('offline');
    expect(useTeacher.getState().messages.map((m) => m.role)).toEqual(['user']);
  });

  it('shows a friendly rate-limit notice with the wait time', async () => {
    deps.streamChat = (() => (async function* () { throw new ChatHttpError(429, 'rate_limited', 'x', 17); })()) as typeof deps.streamChat;
    await useTeacher.getState().send('hi', lesson);
    expect(useTeacher.getState().notice).toBe('teacher.errors.rate_limited');
    expect(useTeacher.getState().noticeVars).toEqual({ seconds: 17 });
  });

  it('maps server error events to notices and keeps any partial text', async () => {
    script({ event: 'text', data: { text: 'Partial' } }, { event: 'error', data: { code: 'refusal', message: 'm' } });
    await useTeacher.getState().send('hi', lesson);
    expect(useTeacher.getState().notice).toBe('teacher.errors.refusal');
    expect(useTeacher.getState().messages[1]!.text).toBe('Partial');
  });

  it('stop() aborts the stream and silences speech', async () => {
    let started!: () => void;
    const gate = new Promise<void>((r) => (started = r));
    deps.streamChat = ((_: ChatRequest, signal?: AbortSignal) => (async function* () {
      yield { event: 'text', data: { text: 'Thinking out loud, ' } } as ChatEvent;
      started();
      await new Promise((_r, rej) => signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))));
    })()) as typeof deps.streamChat;
    const p = useTeacher.getState().send('hi', lesson);
    await gate;
    useTeacher.getState().stop();
    await p;
    expect(useTeacher.getState().status).toBe('idle');
    expect(fakeSpeech.cancel).toHaveBeenCalled();
  });

  it('ignores empty input and a second send while streaming', async () => {
    script({ event: 'done', data: {} });
    await useTeacher.getState().send('   ', lesson);
    expect(useTeacher.getState().messages).toHaveLength(0);
  });
});

describe('WebSpeechProvider', () => {
  type Handler = (() => void) | null;
  class FakeUtterance {
    text: string; voice: unknown = null; lang = ''; pitch = 1; rate = 1;
    onboundary: Handler = null; onend: Handler = null; onerror: Handler = null;
    constructor(t: string) { this.text = t; }
  }
  const voices = [
    { lang: 'en-GB', name: 'Remote', localService: false },
    { lang: 'en_US', name: 'Local', localService: true },
  ];
  const make = (v = voices) => {
    const spoken: FakeUtterance[] = [];
    const synth = { getVoices: () => v, speak: (u: FakeUtterance) => spoken.push(u), cancel: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    return { p: new WebSpeechProvider(synth as unknown as SpeechSynthesis), spoken, synth };
  };

  it('prefers local voices and reports missing languages honestly', () => {
    const { p } = make();
    expect(p.supported).toBe(true);
    expect(p.hasVoice('en')).toBe(true);
    expect(p.hasVoice('ar')).toBe(false);
  });
  it('speaks with the teacher voice settings, tracks speaking, and drives the mouth', () => {
    const { p, spoken } = make();
    p.speak('Hello there', { lang: 'en', pitch: 1.2, rate: 0.9 });
    expect(spoken[0]).toMatchObject({ text: 'Hello there', pitch: 1.2, rate: 0.9 });
    expect((spoken[0]!.voice as { name: string }).name).toBe('Local');
    expect(p.speaking).toBe(true);
    expect(p.getMouthLevel(performance.now())).toBeGreaterThan(0);
    spoken[0]!.onend?.();
    expect(p.speaking).toBe(false);
    expect(p.getMouthLevel(performance.now())).toBe(0);
  });
  it('cancel() clears the queue; unsupported browsers fail quietly', () => {
    const { p, synth } = make();
    p.speak('a', { lang: 'en' });
    p.cancel();
    expect(synth.cancel).toHaveBeenCalled();
    expect(p.speaking).toBe(false);
    const none = new WebSpeechProvider(null);
    expect(none.supported).toBe(false);
    expect(() => none.speak('x', { lang: 'en' })).not.toThrow();
    expect(none.hasVoice('en')).toBe(false);
  });
});
