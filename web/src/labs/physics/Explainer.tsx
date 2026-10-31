import { useTranslation } from 'react-i18next';
import type { Setup, Theory } from './sim/engine';

const LARGE_ANGLE_DEG = 15;

export function Explainer({ setup, theory }: { setup: Setup; theory: Theory }) {
  const { t } = useTranslation();
  const large = setup.mode === 'pendulum' && setup.angleDeg > LARGE_ANGLE_DEG && theory.exact !== null;
  return (
    <section aria-labelledby="ex-title" className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm leading-relaxed">
      <h3 id="ex-title" className="mb-1 font-semibold">{t('physics.explain.title')}</h3>
      <div className="space-y-2 text-slate-200">
        {setup.mode === 'pendulum' ? (
          <>
            <p className={large ? 'rounded-md border border-amber-400/60 bg-amber-400/10 p-2' : ''}>
              {large
                ? t('physics.explain.pendLarge', {
                    angle: setup.angleDeg,
                    exact: theory.exact!.toFixed(3),
                    small: theory.small.toFixed(3),
                    error: ((theory.smallAngleError ?? 0) * 100).toFixed(1),
                  })
                : t('physics.explain.pendSmall')}
            </p>
            <p>{t('physics.explain.pendMass')}</p>
          </>
        ) : (
          <p>{t('physics.explain.springIdeal')}</p>
        )}
        <p>{t('physics.explain.energy')}</p>
      </div>
    </section>
  );
}
