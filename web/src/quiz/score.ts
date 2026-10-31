import type { QuizDef } from './quizData';

export interface QuestionResult {
  id: string;
  chosen: number | null;
  correct: number;
  isCorrect: boolean;
}
export interface QuizResult {
  score: number;
  total: number;
  passed: boolean;
  perQuestion: QuestionResult[];
}

/** Deterministic scoring. An unanswered question simply scores zero. */
export function scoreQuiz(def: QuizDef, answers: (number | null)[]): QuizResult {
  const perQuestion = def.questions.map((q, i): QuestionResult => {
    const chosen = Number.isInteger(answers[i]) ? (answers[i] as number) : null;
    return { id: q.id, chosen, correct: q.answer, isCorrect: chosen === q.answer };
  });
  const score = perQuestion.filter((r) => r.isCorrect).length;
  return { score, total: def.questions.length, passed: score >= def.passMark, perQuestion };
}

export type FeedbackBand = 'perfect' | 'good' | 'retry';
export function feedbackBand(r: Pick<QuizResult, 'score' | 'total' | 'passed'>): FeedbackBand {
  if (r.score === r.total) return 'perfect';
  return r.passed ? 'good' : 'retry';
}
