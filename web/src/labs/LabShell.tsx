import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LessonMeta } from '../core/lessons';
import { TeacherPanel } from '../teacher/TeacherPanel';

/** Common frame for every lab: header, teacher intro, and the lab body. */
export function LabShell({ lesson, children }: { lesson: LessonMeta; children?: ReactNode }) {
  const { t } = useTranslation();
  const teacher = t(`teachers.${lesson.teacher}.name`);
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
      <Link to="/" className="text-sm text-sky-300 hover:underline">
        <span aria-hidden className="inline-block rtl:rotate-180">←</span> {t('nav.back')}
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold" style={{ color: lesson.accent }}>
        {t(`subjects.${lesson.subject}.lab`)}
      </h1>
      <p className="mt-1 text-slate-300">{t('lab.meetTeacher', { name: teacher })} · {t(`teachers.${lesson.teacher}.role`)}</p>
      <TeacherPanel lesson={lesson} />
      {children ? (
        <div className="mt-5">{children}</div>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed border-slate-600 p-8 text-center text-slate-300">
          {t('lab.comingSoon')}
        </div>
      )}
    </div>
  );
}
