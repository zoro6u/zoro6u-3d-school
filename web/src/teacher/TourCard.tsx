import { useTranslation } from 'react-i18next';
import type { LessonMeta } from '../core/lessons';
import { useQuizUI } from '../quiz/store';
import { quizzes } from '../quiz/quizData';
import { useTour } from './tourStore';

/** Shown inside the teacher panel while a scripted tour is running. Needs no network and no API key. */
export function TourCard({ lesson }: { lesson: LessonMeta }) {
  const { t } = useTranslation();
  const { state, start, pause, resume, next, prev, stop } = useTour();
  const finished = state.status === 'finished';
  const playing = state.status === 'playing';
  const btn = 'rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm font-medium hover:bg-slate-700 disabled:opacity-40';

  if (finished)
    return (
      <div className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
        <h3 className="m-0 text-lg font-bold" style={{ color: lesson.accent }}>{t('teacher.tour.finishedTitle')}</h3>
        <p className="m-0">{t('teacher.tour.finishedBody')}</p>
        <div className="flex flex-wrap gap-2">
          {quizzes[lesson.id] && (
            <button className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-950" style={{ background: lesson.accent }} onClick={() => { stop(); useQuizUI.getState().open(lesson.id); }}>
              {t('teacher.tour.quiz')}
            </button>
          )}
          <button className={btn} onClick={() => start(lesson)}>{t('teacher.tour.replay')}</button>
          <button className={btn} onClick={stop}>{t('teacher.tour.backToChat')}</button>
        </div>
      </div>
    );

  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-3 text-sm" role="region" aria-label={t('teacher.tour.narration')}>
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-400 rtl:normal-case rtl:tracking-normal">{t('teacher.tour.stepOf', { n: state.index + 1, total: state.total })}</p>
        <button className="text-xs text-slate-300 underline hover:text-white" onClick={stop}>{t('teacher.tour.stop')}</button>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-label={t('teacher.tour.progress')} aria-valuemin={1} aria-valuemax={state.total} aria-valuenow={state.index + 1}>
        <div className="h-full transition-[width]" style={{ width: `${((state.index + 1) / state.total) * 100}%`, background: lesson.accent }} />
      </div>
      <p className="m-0 rounded-xl border-s-4 bg-slate-800 p-3 text-base leading-relaxed" style={{ borderColor: lesson.accent }} aria-live="polite">{state.text}</p>
      {state.chips.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-1 p-0">
          {state.chips.map((c, i) => (
            <li key={i} className={`rounded-full px-2 py-0.5 text-[11px] ${c.ok ? 'bg-emerald-500/20 text-emerald-200' : 'bg-red-500/20 text-red-200'}`}><bdi dir="ltr">{c.label}</bdi></li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button className={btn} onClick={prev} disabled={state.index === 0}><span aria-hidden className="inline-block rtl:rotate-180">◀</span> {t('teacher.tour.prev')}</button>
        <button className={`${btn} min-w-24 !border-transparent font-semibold !text-slate-950`} style={{ background: lesson.accent }} onClick={() => (playing ? pause() : resume())}>
          {t(playing ? 'teacher.tour.pause' : 'teacher.tour.resume')}
        </button>
        <button className={btn} onClick={next}>{t('teacher.tour.next')} <span aria-hidden className="inline-block rtl:rotate-180">▶</span></button>
      </div>
    </div>
  );
}
