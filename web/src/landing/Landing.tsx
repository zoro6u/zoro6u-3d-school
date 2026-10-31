import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { lessons, type Subject } from '../core/lessons';
import { useSettings } from '../store/settings';
import { hasWebGL } from './hasWebGL';
import { CanvasBoundary } from '../app/CanvasBoundary';
import { LessonBadge } from '../app/LessonBadge';
import { quizzes } from '../quiz/quizData';
import { lessonStatus, useProgress } from '../store/progress';

const Hallway = lazy(() => import('./Hallway'));
const webgl = hasWebGL();

export function Landing() {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState<Subject | null>(null);
  const lowGraphics = useSettings((s) => s.lowGraphics);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const progress = useProgress((s) => s.lessons);
  const resetProgress = useProgress((s) => s.reset);
  const [confirmReset, setConfirmReset] = useState(false);
  const done = lessons.filter((l) => lessonStatus(progress[l.id], quizzes[l.id]?.def.passMark ?? 2) === 'completed').length;
  const anyProgress = Object.keys(progress).length > 0;

  return (
    <div className="flex flex-1 flex-col">
      <section className="relative min-h-[46vh] flex-1 bg-slate-900" aria-label={t('landing.canvasLabel')}>
        {webgl ? (
          <div className="absolute inset-0" role="img" aria-label={t('landing.canvasLabel')}>
            <CanvasBoundary><Suspense fallback={null}>
              <Hallway lessons={lessons} hovered={hovered} onHover={setHovered} lowGraphics={lowGraphics} reducedMotion={reducedMotion} />
            </Suspense></CanvasBoundary>
          </div>
        ) : (
          <p className="p-6 text-center text-slate-300">{t('landing.noWebgl')}</p>
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-slate-950/95 via-slate-900/75 to-transparent p-5 pb-14 text-center [text-shadow:0_2px_14px_#020617]">
          <h1 className="text-2xl font-extrabold sm:text-4xl">{t('app.name')}</h1>
          <p className="mx-auto mt-1 max-w-xl text-sm text-slate-300 sm:text-base">{t('app.tagline')}</p>
        </div>
      </section>

      <section className="border-t border-slate-800 bg-slate-950 px-4 py-5" aria-labelledby="choose">
        <h2 id="choose" className="text-center text-lg font-semibold">{t('landing.choose')}</h2>
        <p className="mb-3 text-center text-sm text-slate-400">{t('landing.hint')}</p>
        {anyProgress && (
          <div className="mx-auto mb-4 flex max-w-md items-center gap-3 text-sm">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-label={t('progress.bar')} aria-valuemin={0} aria-valuemax={lessons.length} aria-valuenow={done}>
              <div className="h-full bg-green-400" style={{ width: `${(done / lessons.length) * 100}%` }} />
            </div>
            <span className="shrink-0 text-slate-300">{t('progress.summary', { done, total: lessons.length })}</span>
          </div>
        )}
        <ul className="mx-auto grid max-w-5xl gap-3 sm:grid-cols-3">
          {lessons.map((l) => (
            <li key={l.id}>
              <Link
                to={l.route}
                onMouseEnter={() => setHovered(l.subject)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(l.subject)}
                onBlur={() => setHovered(null)}
                style={{ borderColor: l.accent }}
                className="block h-full rounded-xl border-2 bg-slate-900 p-4 transition-colors hover:bg-slate-800"
              >
                <span className="text-sm font-semibold uppercase tracking-wide rtl:normal-case rtl:tracking-normal" style={{ color: l.accent }}>{t(`subjects.${l.subject}.name`)}</span>
                <span className="mt-1 block text-lg font-bold">{t(`subjects.${l.subject}.lab`)}</span>
                <span className="mt-1 block text-sm text-slate-300">{t(`subjects.${l.subject}.blurb`)}</span>
                <LessonBadge lessonId={l.id} className="mt-2" />
                <span className="mt-3 block text-sm font-medium text-sky-300">{t('landing.enter')} <span aria-hidden className="inline-block rtl:rotate-180">→</span></span>
              </Link>
            </li>
          ))}
        </ul>
        {anyProgress && (
          <p className="mt-4 text-center text-xs text-slate-400">
            {confirmReset ? (
              <span className="inline-flex items-center gap-2">
                {t('progress.resetConfirm')}
                <button className="rounded border border-red-400/60 px-2 py-0.5 text-red-200 hover:bg-red-400/10" onClick={() => { resetProgress(); setConfirmReset(false); }}>{t('progress.resetYes')}</button>
                <button className="rounded border border-slate-600 px-2 py-0.5 hover:bg-slate-800" onClick={() => setConfirmReset(false)}>{t('progress.resetNo')}</button>
              </span>
            ) : (
              <button className="underline hover:text-slate-200" onClick={() => setConfirmReset(true)}>{t('progress.reset')}</button>
            )}
          </p>
        )}
      </section>
    </div>
  );
}
