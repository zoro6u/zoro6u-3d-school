import { useTranslation } from 'react-i18next';
import type { Snapshot, Setup } from './sim/engine';

const f = (n: number, d: number) => n.toFixed(d);

function Row({ label, value, unit, strong }: { label: string; value: string; unit: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <dt className="text-slate-300">{label}</dt>
      <dd className={`m-0 tabular-nums ${strong ? 'font-bold text-white' : ''}`}><bdi dir="ltr">{value} {unit}</bdi></dd>
    </div>
  );
}

export function Readouts({ snap, setup }: { snap: Snapshot; setup: Setup }) {
  const { t } = useTranslation();
  const pend = setup.mode === 'pendulum';
  const th = snap.theory;
  const measured = snap.measuredMean;
  const diff = measured !== null ? (measured / (th.exact ?? th.small) - 1) * 100 : null;
  return (
    <div className="space-y-4 text-sm">
      <section aria-labelledby="ro-live" className="rounded-xl border border-slate-700 bg-slate-900 p-3">
        <h3 id="ro-live" className="mb-1 font-semibold">{t('physics.readouts.title')}</h3>
        <dl className="m-0">
          <Row label={t('physics.readouts.time')} value={f(snap.time, 1)} unit="s" />
          <Row label={t(pend ? 'physics.readouts.angle' : 'physics.readouts.displacement')} value={pend ? f((snap.x * 180) / Math.PI, 1) : f(snap.x, 3)} unit={pend ? '°' : 'm'} />
          <Row label={t(pend ? 'physics.readouts.omega' : 'physics.readouts.velocity')} value={f(snap.v, 2)} unit={pend ? 'rad/s' : 'm/s'} />
          <Row label={t('physics.readouts.ke')} value={f(snap.ke, 3)} unit="J" />
          <Row label={t('physics.readouts.pe')} value={f(snap.pe, 3)} unit="J" />
          <Row label={t('physics.readouts.total')} value={f(snap.total, 3)} unit="J" strong />
        </dl>
      </section>
      <section aria-labelledby="ro-period" className="rounded-xl border border-slate-700 bg-slate-900 p-3">
        <h3 id="ro-period" className="mb-1 font-semibold">{t('physics.period.title')}</h3>
        <dl className="m-0">
          <Row label={t('physics.period.small')} value={f(th.small, 3)} unit="s" />
          {th.exact !== null && <Row label={t('physics.period.exact')} value={f(th.exact, 3)} unit="s" />}
          {th.damped !== null && <Row label={t('physics.period.damped')} value={f(th.damped, 3)} unit="s" />}
          <Row label={t('physics.period.measured')} value={measured !== null ? f(measured, 3) : t('physics.period.none')} unit={measured !== null ? 's' : ''} strong />
        </dl>
        <p className="mt-1 text-xs text-slate-400" role="status">
          {measured !== null
            ? `${t('physics.period.cycles', { count: snap.cycles })}${diff !== null && setup.damping === 0 ? ` · Δ ${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%` : ''}`
            : t('physics.period.waiting')}
        </p>
      </section>
    </div>
  );
}
