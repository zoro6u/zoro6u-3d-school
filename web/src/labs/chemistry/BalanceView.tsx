import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { balanceReport, correctCoeffs, onesCoeffs, type Coeffs } from './engine/balance';
import { elementDef } from './engine/elements';
import type { Reaction } from './engine/types';

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const MAX = 9;

function Dots({ el, n }: { el: string; n: number }) {
  const shown = Math.min(n, 24);
  return (
    <span className="inline-flex flex-wrap items-center gap-0.5" aria-hidden>
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} className="inline-block size-3 rounded-full ring-1 ring-slate-500" style={{ background: elementDef(el)?.color ?? '#999' }} />
      ))}
    </span>
  );
}

/** Interactive balancing: students change coefficients and watch the atom counts on each side. */
export function BalanceView({ reaction, lang, onWatch }: { reaction: Reaction; lang: 'en' | 'ar'; onWatch: () => void }) {
  const { t } = useTranslation();
  const { data } = reaction;
  const text = reaction.text[lang];
  const [coeffs, setCoeffs] = useState<Coeffs>(() => onesCoeffs(data));
  const report = balanceReport(data, coeffs);
  const answer = correctCoeffs(data);
  const values = Object.values(coeffs);
  const g = values.reduce(gcd, 0);
  const simplest = g <= 1;
  const matches = Object.keys(answer).every((k) => coeffs[k] === answer[k]);

  const set = (sid: string, d: number) => setCoeffs((c) => ({ ...c, [sid]: Math.min(MAX, Math.max(1, (c[sid] ?? 1) + d)) }));
  const term = (sid: string, side: 'reactants' | 'products') => {
    const n = coeffs[sid] ?? 1;
    const name = text.species[sid] ?? sid;
    return (
      <li key={`${side}-${sid}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2">
        <span className="min-w-0">
          <bdi dir="ltr" className="text-lg font-bold">{data.species[sid]!.formula}</bdi>
          <span className="ms-2 text-xs text-slate-300">{name}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1" role="group" aria-label={t('chemistry.balance.coeff', { name })}>
          <button className="size-8 rounded-md bg-slate-700 text-lg hover:bg-slate-600 disabled:opacity-40" onClick={() => set(sid, -1)} disabled={n <= 1} aria-label={`${t('chemistry.balance.fewer')}: ${name}`}>−</button>
          <output className="w-6 text-center text-lg font-bold tabular-nums" aria-live="polite">{n}</output>
          <button className="size-8 rounded-md bg-slate-700 text-lg hover:bg-slate-600 disabled:opacity-40" onClick={() => set(sid, 1)} disabled={n >= MAX} aria-label={`${t('chemistry.balance.more')}: ${name}`}>+</button>
        </span>
      </li>
    );
  };

  const eq = (side: 'reactants' | 'products') =>
    data.equation[side]
      .map((tm) => `${(coeffs[tm.species] ?? 1) > 1 ? coeffs[tm.species] : ''}${data.species[tm.species]!.formula}`)
      .join(' + ');

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-slate-200">{t('chemistry.balance.intro')}</p>
      <p className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-center text-2xl font-bold" dir="ltr" aria-label={t('chemistry.equation')}>
        {eq('reactants')} <span aria-hidden>→</span> {eq('products')}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="bal-l">
          <h3 id="bal-l" className="mb-2 font-semibold">{t('chemistry.labelReactants')}</h3>
          <ul className="space-y-2">{data.equation.reactants.map((tm) => term(tm.species, 'reactants'))}</ul>
        </section>
        <section aria-labelledby="bal-r">
          <h3 id="bal-r" className="mb-2 font-semibold">{t('chemistry.labelProducts')}</h3>
          <ul className="space-y-2">{data.equation.products.map((tm) => term(tm.species, 'products'))}</ul>
        </section>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-300">
              <th className="p-2 text-start font-medium">{t('chemistry.balance.element')}</th>
              <th className="p-2 text-start font-medium">{t('chemistry.balance.atomsLeft')}</th>
              <th className="p-2 text-start font-medium">{t('chemistry.balance.atomsRight')}</th>
              <th className="w-10 p-2"><span className="sr-only">✓</span></th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((r) => (
              <tr key={r.el} className="border-t border-slate-800">
                <th scope="row" className="p-2 text-start"><bdi dir="ltr" className="font-bold">{r.el}</bdi> <span className="text-xs font-normal text-slate-400">{t(`chemistry.elements.${r.el}`, { defaultValue: '' })}</span></th>
                <td className="p-2"><span className="me-2 font-bold tabular-nums">{r.left}</span><Dots el={r.el} n={r.left} /></td>
                <td className="p-2"><span className="me-2 font-bold tabular-nums">{r.right}</span><Dots el={r.el} n={r.right} /></td>
                <td className={`p-2 text-center text-lg font-bold ${r.ok ? 'text-green-400' : 'text-red-400'}`}><span aria-hidden>{r.ok ? '✓' : '✗'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div role="status" className={`rounded-xl border p-3 text-sm ${report.balanced ? 'border-green-500 bg-green-500/10 text-green-100' : 'border-amber-500/60 bg-amber-500/10 text-amber-100'}`}>
        {report.balanced
          ? <>
              {t('chemistry.balance.balanced')}{' '}
              {!simplest && t('chemistry.balance.notSimplest', { n: g })}
            </>
          : t('chemistry.balance.unbalanced', { elements: report.unbalanced.join(', ') })}
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-700" onClick={() => setCoeffs(onesCoeffs(data))}>{t('chemistry.balance.reset')}</button>
        <button className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-700" onClick={() => setCoeffs(answer)}>{t('chemistry.balance.answer')}</button>
        {report.balanced && matches && (
          <button className="rounded-lg bg-orange-400 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-orange-300" onClick={onWatch}>{t('chemistry.balance.watch')}</button>
        )}
      </div>
      <p className="text-xs text-slate-400">{t('chemistry.balance.tip')}</p>
    </div>
  );
}
