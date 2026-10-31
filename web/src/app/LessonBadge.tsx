import { useTranslation } from 'react-i18next';
import { quizzes } from '../quiz/quizData';
import { lessonStatus, useProgress } from '../store/progress';

/** Small status line for a lab: Completed / quiz best / tour done. Reads saved progress. */
export function LessonBadge({ lessonId, className = '' }: { lessonId: string; className?: string }) {
  const { t } = useTranslation();
  const p = useProgress((s) => s.lessons[lessonId]);
  const passMark = quizzes[lessonId]?.def.passMark ?? 2;
  const status = lessonStatus(p, passMark);
  if (status === 'new') return null;
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 text-xs ${className}`}>
      <span className={`rounded-full px-2 py-0.5 font-semibold ${status === 'completed' ? 'bg-green-500/20 text-green-200' : 'bg-sky-500/20 text-sky-200'}`}>
        <span aria-hidden>{status === 'completed' ? '✓ ' : ''}</span>
        {t(status === 'completed' ? 'progress.completed' : 'progress.started')}
      </span>
      {p?.tourDone && <span className="text-slate-300">{t('progress.tourDone')}</span>}
      {p && p.quizBest !== null && <span className="text-slate-300"><bdi dir="ltr">{t('progress.quizBest', { score: p.quizBest, total: p.quizTotal })}</bdi></span>}
    </span>
  );
}
