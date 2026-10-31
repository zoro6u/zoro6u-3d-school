import { validateAction, type TeacherAction } from './tools';

export interface TourStepDef {
  id: string;
  actions: unknown[];
}
export interface TourDef {
  steps: TourStepDef[];
}
export interface TourText {
  title: string;
  steps: Record<string, string>;
}
export interface Tour {
  lessonId: string;
  def: TourDef;
  text: { en: TourText; ar: TourText };
}

const idOf = (path: string) => /lessons\/([^/]+)\//.exec(path)?.[1] ?? '';
const defs = import.meta.glob<TourDef>('../../../content/lessons/*/tour.json', { eager: true, import: 'default' });
const en = import.meta.glob<TourText>('../../../content/lessons/*/tour.en.json', { eager: true, import: 'default' });
const ar = import.meta.glob<TourText>('../../../content/lessons/*/tour.ar.json', { eager: true, import: 'default' });
const byId = (m: Record<string, TourText>) => Object.fromEntries(Object.entries(m).map(([p, v]) => [idOf(p), v]));
const enById = byId(en);
const arById = byId(ar);

export const tours: Record<string, Tour> = Object.fromEntries(
  Object.entries(defs).map(([p, def]) => [idOf(p), { lessonId: idOf(p), def, text: { en: enById[idOf(p)]!, ar: arById[idOf(p)]! } }]),
);

/** Every tour action must pass the same validator the teacher's tool calls pass, and every step needs text in both languages. */
export function validateTour(tour: Tour, lessonRaw: Record<string, unknown>): string[] {
  const errs: string[] = [];
  const e = (m: string) => errs.push(`${tour.lessonId}: ${m}`);
  if (tour.def.steps.length < 3) e('a tour needs at least 3 steps');
  if (new Set(tour.def.steps.map((s) => s.id)).size !== tour.def.steps.length) e('duplicate step ids');
  for (const s of tour.def.steps) {
    s.actions.forEach((a, i) => {
      const r = validateAction(lessonRaw, a);
      if (!r.ok) e(`step ${s.id} action ${i}: ${r.message}`);
    });
    for (const lang of ['en', 'ar'] as const) {
      const t = tour.text[lang]?.steps?.[s.id];
      if (!t || t.trim().length < 20) e(`${lang}: missing or too-short text for step ${s.id}`);
    }
  }
  for (const lang of ['en', 'ar'] as const) {
    const extra = Object.keys(tour.text[lang]?.steps ?? {}).filter((k) => !tour.def.steps.some((s) => s.id === k));
    if (extra.length) e(`${lang}: text for unknown steps ${extra.join(', ')}`);
    if (!tour.text[lang]?.title) e(`${lang}: missing title`);
  }
  return errs;
}

export function stepActions(tour: Tour, lessonRaw: Record<string, unknown>, index: number): TeacherAction[] {
  return (tour.def.steps[index]?.actions ?? []).flatMap((a) => {
    const r = validateAction(lessonRaw, a);
    return r.ok && r.action ? [r.action] : [];
  });
}
