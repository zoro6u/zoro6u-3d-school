import { useEffect } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SettingsBar } from './SettingsBar';
import { DEMO } from '../core/demo';
import { useSettings } from '../store/settings';
import { ErrorBoundary } from './ErrorBoundary';
import { PerfOverlay } from './PerfOverlay';
import { QualityNotice } from './QualityNotice';
import { useLocation } from 'react-router-dom';

export function Layout() {
  const { t } = useTranslation();
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const location = useLocation();
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reducedMotion);
  }, [reducedMotion]);

  return (
    <div className="flex min-h-full flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded focus:bg-yellow-300 focus:px-3 focus:py-1 focus:text-slate-900">
        {t('nav.skip')}
      </a>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <Link to="/" className="text-lg font-bold tracking-tight text-sky-300">
          {t('app.name')}
        </Link>
        <SettingsBar />
      </header>
      {DEMO && (
        <p role="note" className="m-0 border-b border-sky-400/30 bg-sky-400/10 px-4 py-1.5 text-center text-xs text-sky-100">{t('demo.banner')}</p>
      )}
      <QualityNotice />
      <PerfOverlay />
      <main id="main" className="flex flex-1 flex-col">
        <ErrorBoundary
          resetKey={location.pathname}
          fallback={(reset) => (
            <div role="alert" className="m-auto max-w-md space-y-3 p-8 text-center">
              <p className="m-0 text-lg font-semibold">{t('errors.page')}</p>
              <div className="flex justify-center gap-2">
                <button className="rounded-lg bg-sky-400 px-4 py-2 font-semibold text-slate-900" onClick={reset}>{t('errors.retry')}</button>
                <Link to="/" className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2" onClick={reset}>{t('nav.home')}</Link>
              </div>
            </div>
          )}
        >
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
