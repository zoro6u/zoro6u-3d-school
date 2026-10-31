import { describe, expect, it } from 'vitest';
import cases from '../../../content/tests/tool-cases.json';
import { lessonRaws } from '../core/lessons';
import { focusIds, paramSpecs, validateAction, validateToolCall } from './tools';

interface Case {
  lesson: string;
  tool: string;
  args: unknown;
  ok: boolean;
  action?: unknown;
  why?: string;
}

describe('tool validation: shared cases (same file the Python suite runs)', () => {
  for (const c of cases.cases as Case[]) {
    it(`${c.lesson.slice(0, 4)} ${c.tool} ${JSON.stringify(c.args)} → ${c.ok ? 'ok' : 'rejected'}`, () => {
      const r = validateToolCall(lessonRaws[c.lesson]!, c.tool, c.args);
      expect(r.ok, r.message).toBe(c.ok);
      if (c.ok) expect(r.action).toEqual(c.action);
      else expect(r.message.length).toBeGreaterThan(0);
    });
  }
});

describe('tool validation: extras', () => {
  const physics = lessonRaws['physics-oscillations']!;
  it('rejects non-object args and non-finite numbers', () => {
    expect(validateToolCall(physics, 'set_param', 'x').ok).toBe(false);
    expect(validateToolCall(physics, 'set_param', { name: 'pendulum_length', value: Number.NaN }).ok).toBe(false);
    expect(validateToolCall(physics, 'set_param', { name: 'pendulum_length', value: Infinity }).ok).toBe(false);
  });
  it('ranges come from the lab data (single source of truth)', () => {
    const spec = (physics.physics as { pendulum: { length: { min: number; max: number } } }).pendulum.length;
    expect(paramSpecs(physics).pendulum_length).toMatchObject({ min: spec.min, max: spec.max });
  });
  it('focus ids for biology come from the organelle list', () => {
    expect(focusIds(lessonRaws['biology-animal-cell']!)).toContain('golgi');
    expect(focusIds(lessonRaws['biology-animal-cell']!)).toHaveLength(9);
  });
  it('validateAction round-trips the server\'s normalised actions and rejects junk', () => {
    expect(validateAction(physics, { tool: 'set_param', name: 'gravity', value: 'mars' }).ok).toBe(true);
    expect(validateAction(physics, { tool: 'set_param', name: 'gravity', value: 'pluto' }).ok).toBe(false);
    expect(validateAction(physics, null).ok).toBe(false);
    expect(validateAction(physics, { name: 'gravity' }).ok).toBe(false);
  });
});
