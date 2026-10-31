export interface QuizQuestionDef {
  id: string;
  /** Index of the correct choice. */
  answer: number;
}
export interface QuizDef {
  passMark: number;
  questions: QuizQuestionDef[];
}
export interface QuizQuestionText {
  prompt: string;
  choices: string[];
  explanation: string;
}
export interface QuizText {
  title: string;
  questions: Record<string, QuizQuestionText>;
}
export interface Quiz {
  lessonId: string;
  def: QuizDef;
  text: { en: QuizText; ar: QuizText };
}

const idOf = (path: string) => /lessons\/([^/]+)\//.exec(path)?.[1] ?? '';
const defs = import.meta.glob<QuizDef>('../../../content/lessons/*/quiz.json', { eager: true, import: 'default' });
const en = import.meta.glob<QuizText>('../../../content/lessons/*/quiz.en.json', { eager: true, import: 'default' });
const ar = import.meta.glob<QuizText>('../../../content/lessons/*/quiz.ar.json', { eager: true, import: 'default' });
const byId = (m: Record<string, QuizText>) => Object.fromEntries(Object.entries(m).map(([p, v]) => [idOf(p), v]));
const enById = byId(en);
const arById = byId(ar);

export const quizzes: Record<string, Quiz> = Object.fromEntries(
  Object.entries(defs).map(([p, def]) => [idOf(p), { lessonId: idOf(p), def, text: { en: enById[idOf(p)]!, ar: arById[idOf(p)]! } }]),
);

/** Returns a list of problems; empty means the quiz data is valid in both languages. */
export function validateQuiz(q: Quiz): string[] {
  const errs: string[] = [];
  const e = (m: string) => errs.push(`${q.lessonId}: ${m}`);
  if (q.def.questions.length !== 3) e('must have exactly 3 questions');
  if (!Number.isInteger(q.def.passMark) || q.def.passMark < 1 || q.def.passMark > q.def.questions.length) e('passMark out of range');
  if (new Set(q.def.questions.map((x) => x.id)).size !== q.def.questions.length) e('duplicate question ids');
  for (const lang of ['en', 'ar'] as const) {
    const text = q.text[lang];
    if (!text?.title) e(`${lang}: missing title`);
    for (const qu of q.def.questions) {
      const t = text?.questions?.[qu.id];
      if (!t) {
        e(`${lang}: missing text for ${qu.id}`);
        continue;
      }
      if (!t.prompt || !t.explanation) e(`${lang}/${qu.id}: prompt and explanation required`);
      if (t.choices.length !== 4) e(`${lang}/${qu.id}: needs exactly 4 choices`);
      if (new Set(t.choices).size !== t.choices.length) e(`${lang}/${qu.id}: duplicate choices`);
      if (!Number.isInteger(qu.answer) || qu.answer < 0 || qu.answer >= t.choices.length) e(`${lang}/${qu.id}: answer index out of range`);
    }
  }
  return errs;
}
