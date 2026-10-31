import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../store/settings';
import { ErrorBoundary } from './ErrorBoundary';

/** Wrap a 3D canvas: if it fails to start (no WebGL, context error), offer low graphics instead of a blank page. */
export function CanvasBoundary({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const lowGraphics = useSettings((s) => s.lowGraphics);
  const setLow = useSettings((s) => s.setLowGraphics);
  return (
    <ErrorBoundary
      resetKey={lowGraphics}
      fallback={(reset) => (
        <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-sm text-slate-300">
          <p className="m-0">{t('errors.canvas')}</p>
          <div className="flex gap-2">
            {!lowGraphics && (
              <button className="rounded-lg bg-sky-400 px-3 py-1.5 font-semibold text-slate-900" onClick={() => setLow(true)}>{t('errors.useLow')}</button>
            )}
            <button className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5" onClick={reset}>{t('errors.retry')}</button>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
