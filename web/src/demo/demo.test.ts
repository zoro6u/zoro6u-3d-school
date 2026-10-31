import { describe, expect, it } from 'vitest';
import type { ChatRequest } from '../teacher/chatClient';
import { consumeChat } from '../teacher/session';
import { lessonRaws } from '../core/lessons';
import { demoStream } from './demoTeacher';

const req = (lesson: string, text: string, o: Partial<ChatRequest> = {}): ChatRequest => ({
  lesson_id: lesson, lang: 'en', mode: 'explain', messages: [{ role: 'user', content: text }], scene_state: null, ...o,
});
async function run(r: ChatRequest) {
  const events = [];
  for await (const e of demoStream(r)) events.push(e);
  return events;
}
const text = (evs: Awaited<ReturnType<typeof run>>) => evs.filter((e) => e.event === 'text').map((e) => (e as { data: { text: string } }).data.text).join('');

describe('demo teacher (scripted, same protocol as the real stream)', () => {
  it('answers "moon" with text, a validated set_param action, more text, then done', async () => {
    const evs = await run(req('physics-oscillations', 'What happens on the Moon?'));
    expect(evs.at(-1)!.event).toBe('done');
    expect(evs.filter((e) => e.event === 'action').map((e) => e.data)).toEqual([{ tool: 'set_param', name: 'gravity', value: 'moon' }]);
    expect(text(evs)).toContain('1.62 meters per second squared');
  });
  it('never emits an out-of-range action (the "testbad" script asks for length 99)', async () => {
    const evs = await run(req('physics-oscillations', 'testbad'));
    expect(evs.some((e) => e.event === 'action')).toBe(false);
    expect(text(evs)).toContain('outside what the lab allows');
  });
  it('socratic mode ends with a question; Arabic replies in Arabic', async () => {
    expect(text(await run(req('biology-animal-cell', 'mitochondria', { mode: 'socratic' })))).toMatch(/\?$/);
    const ar = await run(req('biology-animal-cell', 'nucleus', { lang: 'ar' }));
    expect(text(ar)).toMatch(/النواة/);
    expect(ar.filter((e) => e.event === 'action').map((e) => e.data)).toEqual([{ tool: 'focus_object', id: 'nucleus' }]);
  });
  it('falls back to a helpful default and mentions the live scene', async () => {
    const out = text(await run(req('physics-oscillations', 'hello', { scene_state: { experiment: 'pendulum', params: { start_angle_deg: 45 } } })));
    expect(out).toContain('45 degrees');
  });
  it('plugs into the real stream consumer: speech sentences + actions come out right', async () => {
    const said: string[] = [];
    const acts: unknown[] = [];
    await consumeChat(demoStream(req('chemistry-water-synthesis', 'where do the bonds break?')), lessonRaws['chemistry-water-synthesis']!, {
      onText: () => undefined, onSentence: (s) => said.push(s), onAction: (a) => acts.push(a), onError: () => undefined, onDone: () => undefined,
    });
    expect(acts).toEqual([{ tool: 'play_reaction_step', n: 2 }]);
    expect(said.length).toBeGreaterThanOrEqual(2);
  });
  it('every scripted tool call is valid for its lesson (so the demo never shows a rejected action)', async () => {
    const { default: data } = await import('../../../content/demo/teacher-script.json');
    const { validateToolCall } = await import('../teacher/tools');
    const byLesson: Record<string, string> = { physics: 'physics-oscillations', biology: 'biology-animal-cell', chemistry: 'chemistry-water-synthesis' };
    for (const [subject, list] of Object.entries(data.scripts as Record<string, { keywords: string[]; call: { tool: string; args: unknown } }[]>))
      for (const s of list) {
        if (s.keywords.includes('testbad')) continue; // deliberately invalid: demonstrates the validator
        expect(validateToolCall(lessonRaws[byLesson[subject]!]!, s.call.tool, s.call.args).ok, `${subject}: ${s.keywords[0]}`).toBe(true);
      }
  });
});
