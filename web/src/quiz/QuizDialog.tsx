import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LessonMeta } from '../core/lessons';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';
import { useTeacher } from '../teacher/store';
import { quizzes } from './quizData';
import { feedbackBand, scoreQuiz } from './score';
import { useQuizUI } from './store';

/** 3-question quiz. Scoring is deterministic; the teacher's feedback is scripted (and can be expanded by the AI teacher when online). */
export function QuizDialog({ lesson }: { lesson: LessonMeta }) {
  const { t } = useTranslation();
  const lang = useSettings((s) => s.lang);
  const openFor = useQuizUI((s) => s.openFor);
  const close = useQuizUI((s) => s.close);
  const recordQuiz = useProgress((s) => s.recordQuiz);
  const availability = useTeacher((s) => s.availability);
  const quiz = quizzes[lesson.id];
  const ref = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [done, setDone] = useState(false);
  const isOpen = openFor === lesson.id;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (isOpen && !d.open) {
      setIndex(0); setPicked(null); setChecked(false); setAnswers([]); setDone(false);
      d.showModal();
      if (useTeacher.getState().availability === 'unknown') void useTeacher.getState().checkAvailability();
    } else if (!isOpen && d.open) d.close();
  }, [isOpen]);

  if (!quiz) return null;
  const text = quiz.text[lang];
  const total = quiz.def.questions.length;
  const q = quiz.def.questions[index]!;
  const qt = text.questions[q.id]!;
  const teacherName = t(`teachers.${lesson.teacher}.name`);

  const check = () => {
    if (picked === null) return;
    setAnswers((a) => [...a.slice(0, index), picked, ...a.slice(index + 1)]);
    setChecked(true);
  };
  const next = () => {
    if (index + 1 < total) {
      setIndex(index + 1); setPicked(null); setChecked(false);
    } else {
      recordQuiz(lesson.id, scoreQuiz(quiz.def, answers).score, total);
      setDone(true);
    }
  };
  const retry = () => {
    setIndex(0); setPicked(null); setChecked(false); setAnswers([]); setDone(false);
  };

  const result = scoreQuiz(quiz.def, answers);
  const btn = 'rounded-lg px-4 py-2 text-sm font-semibold';
  const primary = `${btn} text-slate-950 disabled:opacity-40`;
  const secondary = `${btn} border border-slate-600 bg-slate-800 hover:bg-slate-700`;

  const askTeacher = (i: number) => {
    const r = result.perQuestion[i]!;
    const tx = text.questions[r.id]!;
    const msg = t('quiz.explainPrompt', {
      mine: r.chosen === null ? t('quiz.unanswered') : tx.choices[r.chosen],
      prompt: tx.prompt,
      correct: tx.choices[r.correct],
    });
    close();
    useTeacher.getState().setOpen(true);
    void useTeacher.getState().send(msg, lesson);
  };

  return (
    <dialog
      ref={ref}
      onClose={close}
      aria-labelledby="quiz-title"
      className="m-auto w-[min(36rem,calc(100vw-1.5rem))] rounded-2xl border-2 bg-slate-900 p-0 text-slate-100 backdrop:bg-black/70"
      style={{ borderColor: lesson.accent }}
    >
      <div className="max-h-[88vh] overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id="quiz-title" className="m-0 text-xl font-extrabold" style={{ color: lesson.accent }}>{text.title}</h2>
          <button onClick={close} aria-label={t('quiz.close')} className="size-8 shrink-0 rounded-md bg-slate-800 text-lg leading-none hover:bg-slate-700">×</button>
        </div>

        {!done ? (
          <form onSubmit={(e) => e.preventDefault()} className="mt-3">
            <p className="m-0 text-xs font-semibold text-slate-400">{t('quiz.questionOf', { n: index + 1, total })}</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={index + (checked ? 1 : 0)} aria-label={t('progress.bar')}>
              <div className="h-full" style={{ width: `${((index + (checked ? 1 : 0)) / total) * 100}%`, background: lesson.accent }} />
            </div>
            <fieldset className="m-0 mt-3 border-0 p-0">
              <legend className="mb-2 text-lg font-semibold leading-snug">{qt.prompt}</legend>
              <div className="space-y-2">
                {qt.choices.map((c, i) => {
                  const isRight = checked && i === q.answer;
                  const isWrong = checked && i === picked && i !== q.answer;
                  return (
                    <label key={i} className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 text-sm ${isRight ? 'border-green-500 bg-green-500/15' : isWrong ? 'border-red-500 bg-red-500/15' : picked === i ? 'border-sky-400 bg-slate-800' : 'border-slate-700 bg-slate-800/60 hover:bg-slate-800'}`}>
                      <input type="radio" name="quiz-choice" className="mt-0.5 size-4 accent-sky-400" checked={picked === i} disabled={checked} onChange={() => setPicked(i)} />
                      <span>{c}</span>
                      {checked && (isRight || isWrong) && <span aria-hidden className="ms-auto font-bold">{isRight ? '✓' : '✗'}</span>}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {checked && (
              <div role="status" className={`mt-3 rounded-xl border p-3 text-sm ${picked === q.answer ? 'border-green-500/60 bg-green-500/10' : 'border-amber-500/60 bg-amber-500/10'}`}>
                <p className="m-0 font-bold">{picked === q.answer ? t('quiz.correct') : t('quiz.incorrect')}</p>
                {picked !== q.answer && <p className="m-0 mt-1">{t('quiz.correctAnswerIs', { answer: qt.choices[q.answer] })}</p>}
                <p className="m-0 mt-2 text-slate-200"><span className="font-semibold">{teacherName}: </span>{qt.explanation}</p>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              {!checked ? (
                <button type="button" onClick={check} disabled={picked === null} className={primary} style={{ background: lesson.accent }}>{t('quiz.check')}</button>
              ) : (
                <button type="button" onClick={next} className={primary} style={{ background: lesson.accent }} autoFocus>{t(index + 1 < total ? 'quiz.next' : 'quiz.results')}</button>
              )}
            </div>
          </form>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="m-0 text-4xl font-extrabold tabular-nums" aria-live="polite"><bdi dir="ltr">{result.score} / {result.total}</bdi></p>
            <p className={`m-0 rounded-xl border p-3 text-sm ${result.passed ? 'border-green-500/60 bg-green-500/10' : 'border-amber-500/60 bg-amber-500/10'}`}>
              <span className="font-bold">{t(result.passed ? 'quiz.passed' : 'quiz.notPassed', { mark: quiz.def.passMark, total: result.total })}</span>
              <span className="mt-1 block text-slate-200"><span className="font-semibold">{teacherName}: </span>{t(`quiz.feedback.${lesson.teacher}.${feedbackBand(result)}`)}</span>
            </p>
            <h3 className="m-0 text-sm font-semibold text-slate-300">{t('quiz.review')}</h3>
            <ol className="m-0 list-none space-y-2 p-0">
              {result.perQuestion.map((r, i) => {
                const tx = text.questions[r.id]!;
                return (
                  <li key={r.id} className={`rounded-xl border p-3 text-sm ${r.isCorrect ? 'border-green-500/50' : 'border-red-500/50'}`}>
                    <p className="m-0 font-semibold">{i + 1}. {tx.prompt}</p>
                    <p className="m-0 mt-1 text-slate-300">{t('quiz.yourAnswer', { answer: r.chosen === null ? t('quiz.unanswered') : tx.choices[r.chosen] })} <span aria-hidden>{r.isCorrect ? '✓' : '✗'}</span></p>
                    {!r.isCorrect && <p className="m-0 mt-1">{t('quiz.correctAnswerIs', { answer: tx.choices[r.correct] })}</p>}
                    <p className="m-0 mt-1 text-slate-300">{tx.explanation}</p>
                    {!r.isCorrect && availability === 'online' && (
                      <button type="button" onClick={() => askTeacher(i)} className="mt-2 rounded-lg border border-sky-400/60 px-3 py-1 text-xs text-sky-200 hover:bg-sky-400/10">{t('quiz.askExplain', { name: teacherName })}</button>
                    )}
                  </li>
                );
              })}
            </ol>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={retry} className={secondary}>{t('quiz.retry')}</button>
              <button type="button" onClick={close} className={primary} style={{ background: lesson.accent }}>{t('quiz.close')}</button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
