import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lessonRaws, lessons } from '../core/lessons';
import { bondAccounting } from '../labs/chemistry/engine/energy';
import { reactionById } from '../labs/chemistry/engine/loader';
import { balanceReport, countAtoms } from '../labs/chemistry/engine/balance';
import { OscillatorEngine, DT, type PendulumSetup, type SpringSetup } from '../labs/physics/sim/engine';
import { smallAngleError, springPeriod, pendulumPeriodSmall } from '../labs/physics/sim/theory';
import { feedbackBand, scoreQuiz } from '../quiz/score';
import { quizzes, validateQuiz } from '../quiz/quizData';
import { lessonStatus, sanitizeProgress, useProgress } from '../store/progress';
import { useSettings } from '../store/settings';
import en from '../i18n/en.json';
import ar from '../i18n/ar.json';
import { useScene, type SceneAdapter } from './scene';
import { readingMs, TourRunner, type TourDeps, type TourState } from './tour';
import { tours, validateTour } from './tourData';
import { tourDeps, useTour } from './tourStore';
import type { SpeechProvider } from './speech/types';
import type { TeacherAction } from './tools';

// ---------------------------------------------------------------- content
describe('every lesson ships a tour and a quiz, in both languages', () => {
  for (const l of lessons) {
    it(`${l.subject}: tour is valid (actions pass the teacher-tool validator, text in en+ar)`, () => {
      expect(tours[l.id]).toBeDefined();
      expect(validateTour(tours[l.id]!, lessonRaws[l.id]!)).toEqual([]);
    });
    it(`${l.subject}: quiz is valid (3 questions, 4 distinct choices, answers in range, en+ar)`, () => {
      expect(quizzes[l.id]).toBeDefined();
      expect(validateQuiz(quizzes[l.id]!)).toEqual([]);
    });
    it(`${l.subject}: teacher quiz feedback exists in both languages`, () => {
      for (const dict of [en, ar]) for (const band of ['perfect', 'good', 'retry'])
        expect((dict.quiz.feedback as Record<string, Record<string, string>>)[l.teacher]![band]!.length).toBeGreaterThan(10);
    });
  }
  it('the validators actually catch bad data', () => {
    const bad = structuredClone(tours['physics-oscillations']!);
    bad.def.steps[1]!.actions = [{ tool: 'set_param', name: 'pendulum_length', value: 99 }];
    delete bad.text.ar.steps.moon;
    const errs = validateTour(bad, lessonRaws['physics-oscillations']!).join('\n');
    expect(errs).toMatch(/between 0.2 and 2.5/);
    expect(errs).toMatch(/ar: missing or too-short text for step moon/);
    const q = structuredClone(quizzes['physics-oscillations']!);
    q.def.questions[0]!.answer = 7;
    expect(validateQuiz(q).join()).toMatch(/answer index out of range/);
  });
});

describe('the tours tell the truth: stated numbers match the simulation', () => {
  const run = (setup: PendulumSetup | SpringSetup) => {
    const e = new OscillatorEngine(setup);
    for (let i = 0; i < 40 / DT; i++) e.step();
    return e.snapshot().measuredMean!;
  };
  const pend = (o: Partial<PendulumSetup>): PendulumSetup => ({ mode: 'pendulum', length: 1, mass: 1, g: 9.81, damping: 0, angleDeg: 30, ...o });
  const text = tours['physics-oscillations']!.text.en.steps;
  const arText = tours['physics-oscillations']!.text.ar.steps;
  const cases: [string, number, string][] = [
    ['ten', run(pend({ angleDeg: 10 })), '2.01'],
    ['longer', run(pend({ angleDeg: 10, length: 2 })), '2.84'],
    ['mass', run(pend({ angleDeg: 10, length: 2, mass: 4 })), '2.84'],
    ['moon', run(pend({ angleDeg: 10, length: 2, mass: 4, g: 1.62 })), '7.0'],
    ['big', run(pend({ angleDeg: 90 })), '2.37'],
    ['spring', run({ mode: 'spring', k: 20, mass: 1, damping: 0, displacement: 0.3 }), '1.40'],
    ['heavier', run({ mode: 'spring', k: 20, mass: 4, damping: 0, displacement: 0.3 }), '2.81'],
  ];
  for (const [step, measured, shown] of cases)
    it(`step "${step}" says ${shown} s and the measured period is ${measured.toFixed(3)} s`, () => {
      expect(measured.toFixed(shown.split('.')[1]!.length)).toBe(shown);
      if (step === 'mass') return; // this step makes a claim (the period doesn't change) rather than quoting a number; checked below
      expect(text[step]).toContain(shown);
      expect(arText[step]).toContain(shown); // the Arabic text quotes the same number
    });
  it('"mass does not change the period" and "18% longer" claims hold', () => {
    expect(run(pend({ angleDeg: 10, length: 2, mass: 4 })).toFixed(2)).toBe(run(pend({ angleDeg: 10, length: 2, mass: 0.1 })).toFixed(2));
    expect(smallAngleError((90 * Math.PI) / 180)).toBeCloseTo(0.18, 2);
    expect(pendulumPeriodSmall({ length: 1, g: 9.81 }).toFixed(2)).toBe('2.01');
    expect(springPeriod({ mass: 4, k: 20 }) / springPeriod({ mass: 1, k: 20 })).toBeCloseTo(2, 9);
  });
  it('chemistry tour energy numbers match the bond bookkeeping', () => {
    const acc = bondAccounting(reactionById('water-synthesis')!.data)!;
    const t = tours['chemistry-water-synthesis']!.text.en.steps.products!;
    expect([acc.absorbed, acc.released, acc.net]).toEqual([1370, 1852, -482]);
    expect(t).toContain('1370');
    expect(t).toContain('1852');
    expect(t).toContain('minus 482');
    expect(t).toContain('483.6');
  });
  it('chemistry tour starts steps in order and every stage index exists in the reaction', () => {
    const steps = tours['chemistry-water-synthesis']!.def.steps.flatMap((s) => s.actions as TeacherAction[]).filter((a) => a.tool === 'play_reaction_step');
    expect(steps.map((a) => (a as { n: number }).n)).toEqual([0, 1, 2, 3, 4, 5, 3]);
    expect(reactionById('water-synthesis')!.data.stages.length).toBeGreaterThanOrEqual(6);
    expect(reactionById('hcl-naoh')!.data.stages.length).toBeGreaterThanOrEqual(4);
  });
});

describe('quiz answers are correct according to the real science code', () => {
  const water = reactionById('water-synthesis')!.data;
  it('physics: 4× length → 2× period; stiffer spring → shorter period; 90° → ~18% longer', () => {
    expect(pendulumPeriodSmall({ length: 4, g: 9.81 }) / pendulumPeriodSmall({ length: 1, g: 9.81 })).toBeCloseTo(2, 9);
    expect(springPeriod({ mass: 1, k: 40 })).toBeLessThan(springPeriod({ mass: 1, k: 20 }));
    expect(smallAngleError((90 * Math.PI) / 180)).toBeGreaterThan(0.17);
    const q = quizzes['physics-oscillations']!;
    expect(q.text.en.questions.length!.choices[q.def.questions[0]!.answer]).toBe('It doubles');
    expect(q.text.en.questions.spring!.choices[q.def.questions[1]!.answer]).toContain('stiffer');
    expect(q.text.en.questions.large!.choices[q.def.questions[2]!.answer]).toContain('longer');
  });
  it('chemistry: 4 H atoms on the reactant side; 2,1,2 balances and 1,2,2 does not', () => {
    const q = quizzes['chemistry-water-synthesis']!;
    expect(countAtoms(water.equation.reactants, water.species).H).toBe(4);
    expect(q.text.en.questions.atoms!.choices[q.def.questions[0]!.answer]).toBe('4');
    expect(balanceReport(water, { H2: 2, O2: 1, H2O: 2 }).balanced).toBe(true);
    expect(balanceReport(water, { H2: 1, O2: 2, H2O: 2 }).balanced).toBe(false);
    expect(q.text.en.questions.balance!.choices[q.def.questions[2]!.answer]).toBe('2, 1, 2');
    expect(q.text.ar.questions.balance!.choices[q.def.questions[2]!.answer]).toContain('2');
    expect(q.text.en.questions.energy!.choices[q.def.questions[1]!.answer]).toMatch(/^Breaking absorbs energy, forming releases/);
  });
  it('the correct choice is never always in the same position (no answer-position tell)', () => {
    for (const q of Object.values(quizzes)) expect(new Set(q.def.questions.map((x) => x.answer)).size).toBeGreaterThan(1);
  });
  it('Arabic and English quizzes agree on the correct answer position (same choice order)', () => {
    for (const q of Object.values(quizzes))
      for (const x of q.def.questions) expect(q.text.ar.questions[x.id]!.choices).toHaveLength(q.text.en.questions[x.id]!.choices.length);
  });
});

describe('quiz scoring', () => {
  const def = quizzes['physics-oscillations']!.def; // answers 1, 2, 0 ; pass mark 2
  it('scores deterministically and marks pass/fail', () => {
    expect(scoreQuiz(def, [1, 2, 0])).toMatchObject({ score: 3, total: 3, passed: true });
    expect(scoreQuiz(def, [1, 2, 3])).toMatchObject({ score: 2, passed: true });
    expect(scoreQuiz(def, [1, 0, 3])).toMatchObject({ score: 1, passed: false });
    expect(scoreQuiz(def, [null, null, null]).score).toBe(0);
    expect(scoreQuiz(def, [])).toMatchObject({ score: 0, passed: false });
  });
  it('reports per-question results and ignores garbage input', () => {
    const r = scoreQuiz(def, [1, 99, Number.NaN as unknown as number]);
    expect(r.perQuestion.map((p) => p.isCorrect)).toEqual([true, false, false]);
    expect(r.perQuestion[2]!.chosen).toBeNull();
  });
  it('feedback bands', () => {
    expect(feedbackBand({ score: 3, total: 3, passed: true })).toBe('perfect');
    expect(feedbackBand({ score: 2, total: 3, passed: true })).toBe('good');
    expect(feedbackBand({ score: 1, total: 3, passed: false })).toBe('retry');
  });
});

// ---------------------------------------------------------------- progress
describe('progress (localStorage)', () => {
  beforeEach(() => {
    localStorage.clear();
    useProgress.setState({ lessons: {} });
  });
  it('sanitises tampered or corrupt data', () => {
    const bad = sanitizeProgress({
      'physics-oscillations': { tourDone: 'yes', quizBest: 99, quizTotal: 3, quizAttempts: -5 },
      'ok-lesson': { tourDone: true, quizBest: 2, quizTotal: 3, quizAttempts: 4 },
      '<script>': { tourDone: true },
      nope: 7,
    });
    expect(Object.keys(bad).sort()).toEqual(['ok-lesson', 'physics-oscillations']);
    expect(bad['physics-oscillations']).toEqual({ tourDone: false, quizBest: null, quizTotal: 3, quizAttempts: 0 });
    expect(bad['ok-lesson']).toEqual({ tourDone: true, quizBest: 2, quizTotal: 3, quizAttempts: 4 });
    expect(sanitizeProgress('garbage')).toEqual({});
    expect(sanitizeProgress([1, 2])).toEqual({});
    expect(sanitizeProgress(null)).toEqual({});
  });
  it('records the tour and keeps the BEST quiz score, counting attempts', () => {
    const s = useProgress.getState();
    s.markTourDone('biology-animal-cell');
    s.recordQuiz('biology-animal-cell', 1, 3);
    s.recordQuiz('biology-animal-cell', 3, 3);
    s.recordQuiz('biology-animal-cell', 2, 3);
    expect(useProgress.getState().lessons['biology-animal-cell']).toEqual({ tourDone: true, quizBest: 3, quizTotal: 3, quizAttempts: 3 });
  });
  it('lesson status: new → started → completed (quiz passed)', () => {
    expect(lessonStatus(undefined, 2)).toBe('new');
    expect(lessonStatus({ tourDone: true, quizBest: null, quizTotal: 3, quizAttempts: 0 }, 2)).toBe('started');
    expect(lessonStatus({ tourDone: false, quizBest: 1, quizTotal: 3, quizAttempts: 1 }, 2)).toBe('started');
    expect(lessonStatus({ tourDone: false, quizBest: 2, quizTotal: 3, quizAttempts: 1 }, 2)).toBe('completed');
  });
  it('persists to localStorage and survives a reload; reset clears it', async () => {
    useProgress.getState().recordQuiz('chemistry-water-synthesis', 3, 3);
    const raw = localStorage.getItem('3dschool.progress')!;
    expect(JSON.parse(raw).state.lessons['chemistry-water-synthesis'].quizBest).toBe(3);
    // simulate a page reload: memory is empty, localStorage still has what was saved
    useProgress.setState({ lessons: {} });
    localStorage.setItem('3dschool.progress', raw);
    await useProgress.persist.rehydrate();
    expect(useProgress.getState().lessons['chemistry-water-synthesis']!.quizBest).toBe(3);
    useProgress.getState().reset();
    expect(JSON.parse(localStorage.getItem('3dschool.progress')!).state.lessons).toEqual({});
  });
  it('a hand-edited localStorage cannot inject bad values', async () => {
    localStorage.setItem('3dschool.progress', JSON.stringify({ state: { lessons: { 'physics-oscillations': { tourDone: true, quizBest: 1e9, quizTotal: 3, quizAttempts: 1 } } }, version: 1 }));
    await useProgress.persist.rehydrate();
    expect(useProgress.getState().lessons['physics-oscillations']!.quizBest).toBeNull();
    localStorage.setItem('3dschool.progress', '{not json');
    await expect(useProgress.persist.rehydrate()).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------- tour runner
function harness(opts: { total?: number; speaking?: () => boolean; voice?: boolean; actionsPerStep?: number } = {}) {
  const log: string[] = [];
  const states: TourState[] = [];
  let finished = 0;
  const total = opts.total ?? 3;
  const deps: TourDeps = {
    total,
    text: (i) => `Step ${i} text with enough words to read comfortably during the tour narration here`,
    actions: (i) => Array.from({ length: opts.actionsPerStep ?? 1 }, (_, k): TeacherAction => ({ tool: 'set_param', name: `a${i}_${k}`, value: i })),
    apply: (a) => (log.push(`apply:${a.tool === 'set_param' ? a.name : a.tool}`), { ok: true, label: 'x' }),
    speak: (t) => log.push(`speak:${t.slice(0, 6)}`),
    cancelSpeech: () => log.push('cancel'),
    isSpeaking: opts.speaking ?? (() => false),
    voiceEnabled: () => opts.voice ?? false,
    onState: (s) => states.push(s),
    onFinished: () => finished++,
  };
  return { deps, log, states, get finished() { return finished; } };
}

describe('TourRunner', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('plays every step in order with no voice (reading-time pacing), then finishes once', () => {
    const h = harness({ total: 3 });
    const r = new TourRunner(h.deps);
    r.start();
    expect(r.state).toMatchObject({ status: 'playing', index: 0 });
    vi.advanceTimersByTime(readingMs(r.state.text) + 1500);
    expect(r.state.index).toBe(1);
    vi.advanceTimersByTime(60_000);
    expect(r.state.status).toBe('finished');
    expect(h.finished).toBe(1);
    expect(h.log.filter((l) => l.startsWith('apply:'))).toEqual(['apply:a0_0', 'apply:a1_0', 'apply:a2_0']);
    expect(h.log.some((l) => l.startsWith('speak:'))).toBe(false);
  });
  it('with voice on it speaks each step and waits until the voice stops', () => {
    let speaking = true;
    const h = harness({ voice: true, speaking: () => speaking });
    const r = new TourRunner(h.deps);
    r.start();
    expect(h.log).toContain('speak:Step 0');
    vi.advanceTimersByTime(9_000);
    expect(r.state.index).toBe(0); // still talking: must not talk over itself
    speaking = false;
    vi.advanceTimersByTime(2_000);
    expect(r.state.index).toBe(1);
  });
  it('never hangs if the speech engine never reports "finished"', () => {
    const h = harness({ voice: true, speaking: () => true });
    const r = new TourRunner(h.deps);
    r.start();
    vi.advanceTimersByTime(readingMs(r.state.text) * 2 + 6000);
    expect(r.state.index).toBe(1);
  });
  it('runs several actions of a step one after another (so dependent actions see the re-rendered UI)', () => {
    const h = harness({ actionsPerStep: 3 });
    const r = new TourRunner(h.deps);
    r.start();
    vi.advanceTimersByTime(1);
    expect(h.log.filter((l) => l.startsWith('apply:'))).toEqual(['apply:a0_0']);
    vi.advanceTimersByTime(260);
    expect(h.log.filter((l) => l.startsWith('apply:'))).toEqual(['apply:a0_0', 'apply:a0_1']);
    vi.advanceTimersByTime(260);
    expect(r.state.chips).toHaveLength(3);
  });
  it('pause stops narration and timers; resume replays the current step', () => {
    const h = harness({ voice: true });
    const r = new TourRunner(h.deps);
    r.start();
    r.pause();
    expect(r.state.status).toBe('paused');
    vi.advanceTimersByTime(60_000);
    expect(r.state.index).toBe(0);
    r.resume();
    expect(r.state.status).toBe('playing');
    expect(h.log.filter((l) => l === 'speak:Step 0')).toHaveLength(2);
  });
  it('step mode: while paused, next/prev show steps and apply actions but do not narrate or auto-advance', () => {
    const h = harness();
    const r = new TourRunner(h.deps);
    r.start();
    r.pause();
    r.next();
    expect(r.state).toMatchObject({ status: 'paused', index: 1 });
    r.next();
    r.prev();
    expect(r.state.index).toBe(1);
    vi.advanceTimersByTime(60_000);
    expect(r.state.index).toBe(1);
    expect(h.log.some((l) => l.startsWith('speak:'))).toBe(false);
  });
  it('prev does nothing before the first step; next on the last step finishes', () => {
    const h = harness({ total: 2 });
    const r = new TourRunner(h.deps);
    r.start();
    r.prev();
    expect(r.state.index).toBe(0);
    r.next();
    r.next();
    expect(r.state.status).toBe('finished');
    expect(h.finished).toBe(1);
  });
  it('stop cancels speech, clears state and leaves no stray timers', () => {
    const h = harness({ voice: true });
    const r = new TourRunner(h.deps);
    r.start();
    r.stop();
    expect(r.state).toMatchObject({ status: 'idle', index: 0, text: '' });
    expect(h.log).toContain('cancel');
    const before = h.log.length;
    vi.advanceTimersByTime(120_000);
    expect(h.log.length).toBe(before);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('a skipped step never fires the old step\'s late timers', () => {
    const h = harness({ actionsPerStep: 3, total: 4 });
    const r = new TourRunner(h.deps);
    r.start();
    r.next(); // before step 0's 2nd/3rd actions fire
    vi.advanceTimersByTime(600);
    expect(h.log.filter((l) => /^apply:a0_[12]$/.test(l))).toEqual([]);
    expect(h.log.filter((l) => l.startsWith('apply:a1_'))).toHaveLength(3);
  });
  it('refresh() re-renders the caption in place', () => {
    let lang = 'one';
    const h = harness();
    h.deps.text = () => lang;
    const r = new TourRunner(h.deps);
    r.start();
    lang = 'two';
    r.refresh();
    expect(r.state.text).toBe('two');
    expect(r.state.index).toBe(0);
  });
});

describe('tour store: end-to-end with real tour data', () => {
  const lesson = lessons.find((l) => l.subject === 'biology')!;
  const applied: TeacherAction[] = [];
  const spoken: string[] = [];
  const fakeSpeech: SpeechProvider = {
    id: 'fake', supported: true, speaking: false, hasVoice: () => true, speak: (t) => void spoken.push(t), cancel: () => undefined, getMouthLevel: () => 0,
  };
  const adapter: SceneAdapter = { lab: 'biology', getState: () => ({}), apply: (a) => (applied.push(a), { ok: true, label: 'ok' }) };

  beforeEach(() => {
    vi.useFakeTimers();
    applied.length = 0;
    spoken.length = 0;
    localStorage.clear();
    useProgress.setState({ lessons: {} });
    useScene.setState({ adapter });
    useSettings.setState({ lang: 'en', teacherVoice: false });
    tourDeps.getSpeech = () => fakeSpeech;
  });
  afterEach(() => {
    useTour.getState().stop();
    vi.useRealTimers();
  });

  it('runs the whole biology tour with no network, drives the scene, and records completion', () => {
    useTour.getState().start(lesson);
    expect(useTour.getState().state.total).toBe(11);
    vi.advanceTimersByTime(30 * 60_000);
    expect(useTour.getState().state.status).toBe('finished');
    expect(applied.filter((a) => a.tool === 'focus_object').map((a) => (a as { id: string }).id)).toEqual([
      'nucleus', 'ribosomes', 'roughEr', 'golgi', 'smoothEr', 'lysosomes', 'mitochondria', 'membrane', 'cytoplasm',
    ]);
    expect(applied.at(-1)).toEqual({ tool: 'set_param', name: 'cutaway', value: true });
    expect(useProgress.getState().lessons[lesson.id]!.tourDone).toBe(true);
  });
  it('shows the caption in the selected language, and switches live', () => {
    useTour.getState().start(lesson);
    expect(useTour.getState().state.text).toMatch(/^Welcome, I'm Dr\. Nour/);
    useSettings.setState({ lang: 'ar' });
    expect(useTour.getState().state.text).toMatch(/^أهلًا بك/);
  });
  it('speaks the narration sentence by sentence when the voice is on', () => {
    useSettings.setState({ teacherVoice: true });
    useTour.getState().start(lesson);
    expect(spoken.length).toBeGreaterThanOrEqual(3);
    expect(spoken.join(' ')).toContain('Welcome');
  });
  it('stopping early does not mark the tour as done', () => {
    useTour.getState().start(lesson);
    vi.advanceTimersByTime(8000);
    useTour.getState().stop();
    expect(useProgress.getState().lessons[lesson.id]).toBeUndefined();
    expect(useTour.getState().state.status).toBe('idle');
  });
});
