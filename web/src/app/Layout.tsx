import { useEffect } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SettingsBar } from './SettingsBar';
import { useSettings } from '../store/settings';

export function Layout() {
  const { t } = useTranslation();
  const reducedMotion = useSettings((s) => s.reducedMotion);
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
      <main id="main" className="flex flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
