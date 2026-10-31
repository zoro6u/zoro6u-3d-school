import { lazy, Suspense, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { lessonBySubject } from '../../core/lessons';
import { hasWebGL } from '../../landing/hasWebGL';
import { useSettings } from '../../store/settings';
import { CanvasBoundary } from '../../app/CanvasBoundary';
import { LabShell } from '../LabShell';
import type { CameraCommand } from './CameraRig';
import { organelles, specOf, type OrganelleId } from './config';
import { chipLabel } from '../../teacher/chips';
import { useRegisterScene } from '../../teacher/scene';
import { isOrganelleId } from './config';
import { biologySceneState, useBiology } from './store';

const Scene3D = lazy(() => import('./Scene3D'));
const webgl = hasWebGL();

export default function BiologyLab() {
  const lesson = lessonBySubject('biology');
  if (!lesson) return null;
  return (
    <LabShell lesson={lesson}>
      <Explorer />
    </LabShell>
  );
}

function Explorer() {
  const { t } = useTranslation();
  const lowGraphics = useSettings((s) => s.lowGraphics);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const { selected, cutaway, select, setCutaway, resetView } = useBiology();
  const commands = useRef<CameraCommand[]>([]);

  useRegisterScene('biology', {
    getState: () => ({ ...biologySceneState(useBiology.getState()), organelle_ids: organelles.map((o) => o.id) }),
    apply: (a) => {
      const st = useBiology.getState();
      if (a.tool === 'focus_object' && isOrganelleId(a.id)) st.select(a.id);
      else if (a.tool === 'set_param' && a.name === 'cutaway' && typeof a.value === 'boolean') st.setCutaway(a.value);
      else if (a.tool === 'reset_scene') {
        st.resetView();
        st.setCutaway(false);
      } else return { ok: false, label: chipLabel(a) };
      return { ok: true, label: chipLabel(a) };
    },
  });

  // Start every visit from a clean scene.
  useEffect(() => () => useBiology.setState({ selected: null, cutaway: false }), []);

  const nameOf = useCallback((id: OrganelleId) => t(`biology.organelles.${id}.name`), [t]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = 0.2;
    const map: Record<string, CameraCommand | undefined> = {
      ArrowLeft: { type: 'rotate', dx: -step, dy: 0 },
      ArrowRight: { type: 'rotate', dx: step, dy: 0 },
      ArrowUp: { type: 'rotate', dx: 0, dy: step },
      ArrowDown: { type: 'rotate', dx: 0, dy: -step },
      '+': { type: 'zoom', factor: 0.85 },
      '=': { type: 'zoom', factor: 0.85 },
      '-': { type: 'zoom', factor: 1 / 0.85 },
      _: { type: 'zoom', factor: 1 / 0.85 },
    };
    const cmd = map[e.key];
    if (cmd) {
      e.preventDefault();
      commands.current.push(cmd);
    } else if (e.key === 'Escape') {
      select(null);
    }
  };

  const btnBase = 'rounded-lg border px-3 py-1.5 text-sm font-medium backdrop-blur';
  const btn = `${btnBase} border-slate-600 bg-slate-900/90 hover:bg-slate-800`;
  const btnOn = `${btnBase} border-sky-400 bg-sky-400 font-semibold text-slate-900 hover:bg-sky-300`;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-2">
        <div
          role="group"
          aria-label={t('biology.canvasLabel')}
          aria-describedby="bio-keys"
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="relative h-[58vh] min-h-[22rem] overflow-hidden rounded-xl border border-slate-700 bg-[#0b1220]"
          dir="ltr"
        >
          {webgl && (
            <CanvasBoundary><Suspense fallback={null}>
              <Scene3D lowGraphics={lowGraphics} reducedMotion={reducedMotion} commands={commands} label={nameOf} />
            </Suspense></CanvasBoundary>
          )}
          <div className="absolute start-3 top-3 z-10 flex flex-wrap gap-2" dir={document.documentElement.dir}>
            <button className={cutaway ? btnOn : btn} aria-pressed={cutaway} onClick={() => setCutaway(!cutaway)}>
              {t('biology.cutaway')}
            </button>
            <button className={btn} onClick={resetView}>{t('biology.resetView')}</button>
          </div>
        </div>
        <p className="text-sm text-slate-300">{t('biology.hint')}</p>
        <p id="bio-keys" className="text-xs text-slate-400">{t('biology.keys')}</p>
        <p className="text-xs text-slate-400">{t('biology.notToScale')}</p>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <InfoPanel selected={selected} />
        <nav aria-labelledby="bio-list" className="rounded-xl border border-slate-700 bg-slate-900 p-3">
          <h3 id="bio-list" className="mb-2 font-semibold">{t('biology.listTitle')}</h3>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
            {organelles.map((o) => (
              <li key={o.id}>
                <button
                  onClick={() => select(selected === o.id ? null : o.id)}
                  aria-pressed={selected === o.id}
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-start text-sm ${selected === o.id ? 'border-white bg-slate-700 font-semibold' : 'border-slate-700 bg-slate-800 hover:bg-slate-700'}`}
                >
                  <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: o.color }} />
                  {nameOf(o.id)}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}

function InfoPanel({ selected }: { selected: OrganelleId | null }) {
  const { t } = useTranslation();
  return (
    <section aria-live="polite" className="rounded-xl border bg-slate-900 p-4" style={{ borderColor: selected ? specOf(selected).color : '#334155' }}>
      {selected ? (
        <>
          <h3 className="text-xl font-bold" style={{ color: specOf(selected).color }}>{t(`biology.organelles.${selected}.name`)}</h3>
          <h4 className="mt-2 text-xs font-semibold uppercase tracking-wide rtl:normal-case rtl:tracking-normal text-slate-400">{t('biology.functionLabel')}</h4>
          <p className="mt-1 text-sm leading-relaxed">{t(`biology.organelles.${selected}.function`)}</p>
          <h4 className="mt-3 text-xs font-semibold uppercase tracking-wide rtl:normal-case rtl:tracking-normal text-slate-400">{t('biology.factLabel')}</h4>
          <p className="mt-1 text-sm leading-relaxed text-slate-200">{t(`biology.organelles.${selected}.fact`)}</p>
        </>
      ) : (
        <p className="text-sm text-slate-300">{t('biology.chooseOne')}</p>
      )}
    </section>
  );
}
