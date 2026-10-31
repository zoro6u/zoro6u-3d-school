import { lazy, Suspense } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isSubject, type Subject } from '../core/lessons';

// Each lab is its own chunk, loaded only when visited.
const labs: Record<Subject, React.LazyExoticComponent<() => React.JSX.Element | null>> = {
  biology: lazy(() => import('./biology')),
  physics: lazy(() => import('./physics')),
  chemistry: lazy(() => import('./chemistry')),
};

export function LabPage() {
  const { subject } = useParams();
  const { t } = useTranslation();
  if (!isSubject(subject)) {
    return (
      <div className="p-8 text-center">
        <p>{t('lab.notFound')}</p>
        <Link to="/" className="text-sky-300 underline">{t('nav.back')}</Link>
      </div>
    );
  }
  const Lab = labs[subject];
  return (
    <Suspense fallback={<p className="p-8 text-center text-slate-400" role="status">…</p>}>
      <Lab />
    </Suspense>
  );
}
