import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { lessonBySubject } from '../../core/lessons';
import { hasWebGL } from '../../landing/hasWebGL';
import { useSettings } from '../../store/settings';
import { chipLabel } from '../../teacher/chips';
import { useRegisterScene } from '../../teacher/scene';
import { LabShell } from '../LabShell';
import { BalanceView } from './BalanceView';
import { EnergyDiagram } from './EnergyDiagram';
import { bondAccounting } from './engine/energy';
import { elementDef } from './engine/elements';
import { reactions } from './engine/loader';
import { ReactionPlayer, type PlayerSnapshot } from './engine/player';
import type { Reaction } from './engine/types';

const Scene3D = lazy(() => import('./Scene3D'));
const webgl = hasWebGL();
const SPEEDS = [0.5, 1, 2] as const;

export default function ChemistryLab() {
  const lesson = lessonBySubject('chemistry');
  if (!lesson || reactions.length === 0) return null;
  return (
    <LabShell lesson={lesson}>
      <Lab />
    </LabShell>
  );
}

function usePlayer(player: ReactionPlayer): PlayerSnapshot {
  const [snap, setSnap] = useState(() => player.snapshot());
  useEffect(() => {
    setSnap(player.snapshot());
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    const tick = (now: number) => {
      player.update((now - last) / 1000);
      last = now;
      if (now - lastUi > 66) {
        lastUi = now;
        setSnap(player.snapshot());
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [player]);
  return snap;
}

function Equation({ reaction, big }: { reaction: Reaction; big?: boolean }) {
  const { data } = reaction;
  const side = (s: 'reactants' | 'products') =>
    data.equation[s].map((t) => `${t.coeff > 1 ? t.coeff : ''}${data.species[t.species]!.formula}`).join(' + ');
  return (
    <p dir="ltr" className={`m-0 font-bold rtl:text-end ${big ? 'text-3xl' : 'text-xl'}`}>
      {side('reactants')} <span aria-hidden>→</span> {side('products')}
    </p>
  );
}

function Lab() {
  const { t } = useTranslation();
  const lang = useSettings((s) => s.lang);
  const lowGraphics = useSettings((s) => s.lowGraphics);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const [rid, setRid] = useState(reactions[0]!.data.id);
  const [view, setView] = useState<'reaction' | 'balance'>('reaction');
  const reaction = reactions.find((r) => r.data.id === rid) ?? reactions[0]!;
  const text = reaction.text[lang];
  const player = useMemo(() => new ReactionPlayer(reaction.data), [reaction]);
  const snap = usePlayer(player);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  useEffect(() => {
    player.speed = speed;
  }, [player, speed]);

  const accounting = useMemo(() => bondAccounting(reaction.data), [reaction]);
  const stage = reaction.data.stages[snap.stage]!;
  const stageText = text.stages[stage.id];
  const latest = useRef({ reaction, view, snap, player });
  latest.current = { reaction, view, snap, player };
  useRegisterScene('chemistry', {
    getState: () => {
      const { reaction: r, view: v, snap: sn, player: pl } = latest.current;
      const st = r.data.stages[sn.stage]!;
      const side = (s: 'reactants' | 'products') => r.data.equation[s].map((t) => `${t.coeff > 1 ? t.coeff : ''}${r.data.species[t.species]!.formula}`).join(' + ');
      return {
        lab: 'chemistry',
        reaction_id: r.data.id,
        equation: `${side('reactants')} → ${side('products')}`,
        view: v,
        step_index: sn.stage,
        step_count: sn.stageCount,
        step_id: st.id,
        step_title: r.text.en.stages[st.id]?.title ?? st.id,
        playing: sn.playing,
        glow: Number(pl.glow.toFixed(2)),
        delta_H_kJ: r.data.deltaH ?? null,
      };
    },
    apply: (a) => {
      const label = chipLabel(a);
      const { player: pl } = latest.current;
      if (a.tool === 'play_reaction_step') {
        setView('reaction');
        pl.goToStage(Math.min(a.n, pl.stageCount - 1));
      } else if (a.tool === 'set_param' && a.name === 'view' && (a.value === 'reaction' || a.value === 'balance')) setView(a.value);
      else if (a.tool === 'set_param' && a.name === 'reaction' && typeof a.value === 'string' && reactions.some((r) => r.data.id === a.value)) {
        setRid(a.value);
        setView('reaction');
      } else if (a.tool === 'set_param' && a.name === 'playing' && typeof a.value === 'boolean') {
        if (a.value) {
          setView('reaction');
          pl.play();
        } else pl.pause();
      } else if (a.tool === 'reset_scene') {
        setView('reaction');
        pl.restart();
      } else return { ok: false, label };
      return { ok: true, label };
    },
  });

  const usedElements = useMemo(() => [...new Set(reaction.data.atoms.map((a) => a.el))], [reaction]);

  const btn = 'rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm font-medium hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40';
  const tab = (active: boolean) => `px-4 py-1.5 text-sm ${active ? 'bg-orange-400 font-semibold text-slate-900' : 'bg-slate-800 hover:bg-slate-700'}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {reactions.length > 1 && (
          <div role="tablist" aria-label={t('chemistry.reactionPicker')} className="inline-flex overflow-hidden rounded-lg border border-slate-600">
            {reactions.map((r) => (
              <button key={r.data.id} role="tab" aria-selected={r.data.id === reaction.data.id} onClick={() => { setRid(r.data.id); setView('reaction'); }} className={tab(r.data.id === reaction.data.id)}>
                {r.text[lang].tab}
              </button>
            ))}
          </div>
        )}
        <div role="tablist" aria-label={t('chemistry.tabs.label')} className="inline-flex overflow-hidden rounded-lg border border-slate-600">
          {(['reaction', 'balance'] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={tab(view === v)}>{t(`chemistry.tabs.${v}`)}</button>
          ))}
        </div>
      </div>

      <header>
        <h2 className="m-0 text-lg font-semibold text-slate-200">{text.title}</h2>
        <Equation reaction={reaction} big />
        <p className="mt-1 text-sm text-slate-300">{text.summary}</p>
      </header>

      {view === 'balance' ? (
        <BalanceView key={reaction.data.id} reaction={reaction} lang={lang} onWatch={() => { setView('reaction'); player.restart(); player.play(); }} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="space-y-3">
            <div role="group" aria-label={t('chemistry.canvasLabel')} className="relative h-72 overflow-hidden rounded-xl border border-slate-700 bg-[#0b1220] sm:h-[26rem]" dir="ltr">
              {webgl && (
                <Suspense fallback={null}>
                  <Scene3D key={reaction.data.id} player={player} lowGraphics={lowGraphics} reducedMotion={reducedMotion} />
                </Suspense>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button className={btn} onClick={() => player.restart()} disabled={snap.atStart && !snap.moving}>{t('chemistry.controls.restart')}</button>
              <button className={btn} onClick={() => player.prev()} disabled={snap.atStart}>
                <span aria-hidden className="inline-block rtl:rotate-180">◀</span> {t('chemistry.controls.prev')}
              </button>
              <button className={`${btn} min-w-24 !border-orange-400 !bg-orange-400 !text-slate-900 hover:!bg-orange-300`} onClick={() => (snap.playing ? player.pause() : player.play())}>
                {snap.playing ? t('chemistry.controls.pause') : snap.atEnd ? t('chemistry.controls.replay') : t('chemistry.controls.play')}
              </button>
              <button className={btn} onClick={() => player.next()} disabled={snap.atEnd}>
                {t('chemistry.controls.next')} <span aria-hidden className="inline-block rtl:rotate-180">▶</span>
              </button>
              <div className="ms-auto flex items-center gap-1 text-sm" role="group" aria-label={t('chemistry.controls.speed')}>
                <span className="me-1 text-slate-300">{t('chemistry.controls.speed')}</span>
                {SPEEDS.map((s) => (
                  <button key={s} aria-pressed={speed === s} onClick={() => setSpeed(s)} className={`rounded-md px-2 py-1 ${speed === s ? 'bg-orange-400 font-semibold text-slate-900' : 'bg-slate-800 hover:bg-slate-700'}`}><bdi dir="ltr">{s}×</bdi></button>
                ))}
              </div>
            </div>

            <div dir="ltr">
              <input
                type="range"
                aria-label={t('chemistry.controls.scrub')}
                min={0}
                max={snap.total}
                step={0.01}
                value={snap.time}
                onChange={(e) => player.seek(Number(e.target.value))}
                className="h-6 w-full cursor-pointer accent-orange-400"
              />
            </div>

            <ol className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label={t('chemistry.controls.scrub')}>
              {reaction.data.stages.map((s, i) => (
                <li key={s.id}>
                  <button
                    onClick={() => player.goToStage(i)}
                    aria-current={i === snap.stage ? 'step' : undefined}
                    aria-label={t('chemistry.controls.jump', { n: i + 1, title: text.stages[s.id]?.title ?? s.id })}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${i === snap.stage ? 'border-orange-400 bg-orange-400/20 font-semibold text-orange-100' : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                  >
                    <span className="font-bold tabular-nums">{i + 1}</span>
                    <span className="hidden sm:inline">{text.stages[s.id]?.title}</span>
                  </button>
                </li>
              ))}
            </ol>

            <section aria-live="polite" aria-label={t('chemistry.caption')} className="rounded-xl border border-orange-400/50 bg-slate-900 p-4">
              <p className="m-0 text-xs font-semibold uppercase tracking-wide text-orange-300 rtl:normal-case rtl:tracking-normal">
                {t('chemistry.controls.stageOf', { n: snap.stage + 1, total: snap.stageCount })}
              </p>
              <h3 className="m-0 mt-1 text-xl font-bold">{stageText?.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-200">{stageText?.caption}</p>
            </section>
          </div>

          <div className="space-y-4">
            <section className="rounded-xl border border-slate-700 bg-slate-900 p-3" aria-labelledby="chem-en">
              <h3 id="chem-en" className="mb-2 font-semibold">{t('chemistry.energy.title')}</h3>
              <EnergyDiagram levels={player.energyLevels} quantitative={player.energyQuantitative} progress={player.progress} deltaH={reaction.data.deltaH ?? null} />
            </section>

            {accounting && (
              <section className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm" aria-labelledby="chem-acc">
                <h3 id="chem-acc" className="mb-1 font-semibold">{t('chemistry.accounting.title')}</h3>
                <p className="m-0 mt-1 text-xs font-semibold text-sky-300">{t('chemistry.accounting.broken')}</p>
                <ul className="m-0 list-none p-0 rtl:text-end" dir="ltr">
                  {accounting.broken.map((b) => <li key={b.key}>{b.count} × {b.key.replace('-', '–')} ({b.each}) = {b.count * b.each} kJ</li>)}
                </ul>
                <p className="m-0 mt-2 text-xs font-semibold text-orange-300">{t('chemistry.accounting.formed')}</p>
                <ul className="m-0 list-none p-0 rtl:text-end" dir="ltr">
                  {accounting.formed.map((b) => <li key={b.key}>{b.count} × {b.key.replace('-', '–')} ({b.each}) = {b.count * b.each} kJ</li>)}
                </ul>
                <p className="m-0 mt-2 font-semibold">
                  {t('chemistry.accounting.estimateLabel')}: <bdi dir="ltr">{accounting.absorbed} − {accounting.released} = {accounting.net} kJ</bdi>
                </p>
                {reaction.data.deltaH !== undefined && (
                  <p className="m-0 text-slate-300">{t('chemistry.accounting.measuredLabel')}: <bdi dir="ltr">{reaction.data.deltaH} kJ</bdi></p>
                )}
              </section>
            )}

            <section className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm" aria-labelledby="chem-legend">
              <h3 id="chem-legend" className="mb-2 font-semibold">{t('chemistry.legend')}</h3>
              <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0">
                {usedElements.map((el) => (
                  <li key={el} className="flex items-center gap-1.5">
                    <span aria-hidden className="inline-block size-4 rounded-full ring-1 ring-slate-500" style={{ background: elementDef(el)?.color }} />
                    <bdi dir="ltr" className="font-bold">{el}</bdi>
                    <span className="text-slate-300">{t(`chemistry.elements.${el}`, { defaultValue: '' })}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-400">{t('chemistry.bondsNote')}</p>
            </section>

            <section className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm" aria-labelledby="chem-note">
              <h3 id="chem-note" className="mb-1 font-semibold">{t('chemistry.mechanismTitle')}</h3>
              {text.notes.mechanism && <p className="m-0 text-slate-200">{text.notes.mechanism}</p>}
              {text.notes.thermo && <p className="m-0 mt-2 text-slate-300">{text.notes.thermo}</p>}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
