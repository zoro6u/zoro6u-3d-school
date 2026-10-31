import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { lessonBySubject } from '../../core/lessons';
import { hasWebGL } from '../../landing/hasWebGL';
import { useSettings } from '../../store/settings';
import { LabShell } from '../LabShell';
import { clampTo, defaultSetup, physicsConfig } from './config';
import { Explainer } from './Explainer';
import { useSimLoop, useSnapshot } from './hooks';
import { LiveChart, type ChartSeries } from './LiveChart';
import { Readouts } from './Readouts';
import { OscillatorEngine, type PendulumSetup, type Setup, type SpringSetup } from './sim/engine';
import { Slider } from './Slider';

const Scene3D = lazy(() => import('./Scene3D'));
const webgl = hasWebGL();
const SPEEDS = [0.25, 0.5, 1] as const;

export default function PhysicsLab() {
  const lesson = lessonBySubject('physics');
  if (!lesson) return null;
  return (
    <LabShell lesson={lesson}>
      <Experiment />
    </LabShell>
  );
}

function Experiment() {
  const { t } = useTranslation();
  const lowGraphics = useSettings((s) => s.lowGraphics);
  const defaults = useMemo(defaultSetup, []);
  const [pend, setPend] = useState<PendulumSetup>(defaults.pendulum);
  const [spr, setSpr] = useState<SpringSetup>(defaults.spring);
  const [mode, setMode] = useState<Setup['mode']>('pendulum');
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const setup: Setup = mode === 'pendulum' ? pend : spr;

  const engine = useMemo(() => new OscillatorEngine(defaults.pendulum), [defaults]);
  useSimLoop(engine);
  useEffect(() => engine.configure(setup), [engine, setup]);
  useEffect(() => engine.setRunning(running), [engine, running]);
  useEffect(() => {
    engine.speed = speed;
  }, [engine, speed]);
  const snap = useSnapshot(engine);

  const P = physicsConfig.pendulum;
  const S = physicsConfig.spring;
  const pendSet = <K extends keyof PendulumSetup>(k: K, v: PendulumSetup[K]) => setPend((p) => ({ ...p, [k]: v }));
  const sprSet = <K extends keyof SpringSetup>(k: K, v: SpringSetup[K]) => setSpr((p) => ({ ...p, [k]: v }));

  const posSeries = useMemo<ChartSeries[]>(
    () => [{ channel: 'position', label: t(mode === 'pendulum' ? 'physics.readouts.angle' : 'physics.readouts.displacement'), color: '#38bdf8' }],
    [t, mode],
  );
  const energySeries = useMemo<ChartSeries[]>(
    () => [
      { channel: 'ke', label: t('physics.readouts.ke'), color: '#38bdf8' },
      { channel: 'pe', label: t('physics.readouts.pe'), color: '#fb923c' },
      { channel: 'total', label: t('physics.readouts.total'), color: '#e2e8f0', dash: [6, 4] },
    ],
    [t],
  );
  const posTitle = t(mode === 'pendulum' ? 'physics.charts.anglePos' : 'physics.charts.springPos');
  const energyTitle = t('physics.charts.energy');
  const posSummary = useMemo(() => (v: string) => t('physics.charts.summary', { title: posTitle, value: v }), [t, posTitle]);
  const energySummary = useMemo(() => (v: string) => t('physics.charts.summary', { title: energyTitle, value: v }), [t, energyTitle]);

  const btn = 'rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm font-medium hover:bg-slate-700';

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="space-y-4">
        <div role="tablist" aria-label={t('physics.tabs.label')} className="inline-flex overflow-hidden rounded-lg border border-slate-600">
          {(['pendulum', 'spring'] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 text-sm ${mode === m ? 'bg-sky-400 font-semibold text-slate-900' : 'bg-slate-800 hover:bg-slate-700'}`}
            >
              {t(`physics.tabs.${m}`)}
            </button>
          ))}
        </div>

        <div className="relative h-72 overflow-hidden rounded-xl border border-slate-700 bg-[#0b1220] sm:h-96" dir="ltr">
          {webgl && (
            <Suspense fallback={null}>
              <Scene3D engine={engine} setup={setup} lowGraphics={lowGraphics} />
            </Suspense>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button className={btn} onClick={() => setRunning((r) => !r)} aria-pressed={!running}>
            {t(running ? 'physics.controls.pause' : 'physics.controls.play')}
          </button>
          <button className={btn} onClick={() => engine.restart()}>{t('physics.controls.restart')}</button>
          <div className="ms-auto flex items-center gap-1 text-sm" role="group" aria-label={t('physics.controls.speed')}>
            <span className="me-1 text-slate-300">{t('physics.controls.speed')}</span>
            {SPEEDS.map((s) => (
              <button key={s} aria-pressed={speed === s} onClick={() => setSpeed(s)} className={`rounded-md px-2 py-1 ${speed === s ? 'bg-sky-400 font-semibold text-slate-900' : 'bg-slate-800 hover:bg-slate-700'}`}>
                <bdi dir="ltr">{s}×</bdi>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <LiveChart engine={engine} title={posTitle} timeLabel={t('physics.charts.time')} unit={mode === 'pendulum' ? '°' : 'm'} series={posSeries} range="symmetric" lowGraphics={lowGraphics} summary={posSummary} />
          <LiveChart engine={engine} title={energyTitle} timeLabel={t('physics.charts.time')} unit="J" series={energySeries} range="zero" lowGraphics={lowGraphics} summary={energySummary} />
        </div>
      </div>

      <div className="space-y-4">
        <section aria-labelledby="ctl" className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-3">
          <h3 id="ctl" className="font-semibold">{t('physics.controls.title')}</h3>
          {mode === 'pendulum' ? (
            <>
              <Slider label={t('physics.controls.length')} unit="m" spec={P.length} value={pend.length} onChange={(v) => pendSet('length', clampTo(P.length, v))} />
              <Slider label={t('physics.controls.mass')} unit="kg" spec={P.mass} value={pend.mass} decimals={1} onChange={(v) => pendSet('mass', clampTo(P.mass, v))} />
              <Slider label={t('physics.controls.angle')} unit="°" spec={P.angleDeg} value={pend.angleDeg} decimals={0} onChange={(v) => pendSet('angleDeg', clampTo(P.angleDeg, v))} />
              <Slider label={t('physics.controls.damping')} unit="N·m·s" spec={P.damping} value={pend.damping} onChange={(v) => pendSet('damping', clampTo(P.damping, v))} />
              <fieldset>
                <legend className="mb-1 text-sm font-medium">{t('physics.controls.gravity')}</legend>
                <div className="flex gap-2" role="radiogroup">
                  {physicsConfig.gravityPresets.map((g) => (
                    <button
                      key={g.id}
                      role="radio"
                      aria-checked={pend.g === g.g}
                      onClick={() => pendSet('g', g.g)}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-sm ${pend.g === g.g ? 'border-sky-400 bg-sky-400 font-semibold text-slate-900' : 'border-slate-600 bg-slate-800 hover:bg-slate-700'}`}
                    >
                      {t(`physics.gravity.${g.id}`)}
                      <bdi dir="ltr" className="block text-xs opacity-80">{g.g} m/s²</bdi>
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          ) : (
            <>
              <Slider label={t('physics.controls.k')} unit="N/m" spec={S.k} value={spr.k} decimals={0} onChange={(v) => sprSet('k', clampTo(S.k, v))} />
              <Slider label={t('physics.controls.mass')} unit="kg" spec={S.mass} value={spr.mass} decimals={1} onChange={(v) => sprSet('mass', clampTo(S.mass, v))} />
              <Slider label={t('physics.controls.displacement')} unit="m" spec={S.displacement} value={spr.displacement} onChange={(v) => sprSet('displacement', clampTo(S.displacement, v))} />
              <Slider label={t('physics.controls.damping')} unit="N·s/m" spec={S.damping} value={spr.damping} onChange={(v) => sprSet('damping', clampTo(S.damping, v))} />
            </>
          )}
        </section>
        <Readouts snap={snap} setup={setup} />
        <Explainer setup={setup} theory={snap.theory} />
      </div>
    </div>
  );
}
