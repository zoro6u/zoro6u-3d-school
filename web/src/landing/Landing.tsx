import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { lessons, type Subject } from '../core/lessons';
import { useSettings } from '../store/settings';
import { hasWebGL } from './hasWebGL';

const Hallway = lazy(() => import('./Hallway'));
const webgl = hasWebGL();

export function Landing() {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState<Subject | null>(null);
  const lowGraphics = useSettings((s) => s.lowGraphics);
  const reducedMotion = useSettings((s) => s.reducedMotion);

  return (
    <div className="flex flex-1 flex-col">
      <section className="relative min-h-[46vh] flex-1 bg-slate-900" aria-label={t('landing.canvasLabel')}>
        {webgl ? (
          <div className="absolute inset-0" role="img" aria-label={t('landing.canvasLabel')}>
            <Suspense fallback={null}>
              <Hallway lessons={lessons} hovered={hovered} onHover={setHovered} lowGraphics={lowGraphics} reducedMotion={reducedMotion} />
            </Suspense>
          </div>
        ) : (
          <p className="p-6 text-center text-slate-300">{t('landing.noWebgl')}</p>
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-slate-900/90 to-transparent p-5 text-center">
          <h1 className="text-2xl font-extrabold sm:text-4xl">{t('app.name')}</h1>
          <p className="mx-auto mt-1 max-w-xl text-sm text-slate-300 sm:text-base">{t('app.tagline')}</p>
        </div>
      </section>

      <section className="border-t border-slate-800 bg-slate-950 px-4 py-5" aria-labelledby="choose">
        <h2 id="choose" className="text-center text-lg font-semibold">{t('landing.choose')}</h2>
        <p className="mb-4 text-center text-sm text-slate-400">{t('landing.hint')}</p>
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
                <span className="text-sm font-semibold uppercase tracking-wide" style={{ color: l.accent }}>{t(`subjects.${l.subject}.name`)}</span>
                <span className="mt-1 block text-lg font-bold">{t(`subjects.${l.subject}.lab`)}</span>
                <span className="mt-1 block text-sm text-slate-300">{t(`subjects.${l.subject}.blurb`)}</span>
                <span className="mt-3 block text-sm font-medium text-sky-300">{t('landing.enter')} <span aria-hidden className="inline-block rtl:rotate-180">→</span></span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
