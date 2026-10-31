import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LessonMeta } from '../core/lessons';
import { QuizDialog } from '../quiz/QuizDialog';
import { quizzes } from '../quiz/quizData';
import { useQuizUI } from '../quiz/store';
import { LessonBadge } from '../app/LessonBadge';
import { TeacherPanel } from '../teacher/TeacherPanel';
import { tours } from '../teacher/tourData';
import { useTeacher } from '../teacher/store';
import { useTour } from '../teacher/tourStore';

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
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {lesson.id in tours && (
          <button
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm font-medium hover:bg-slate-700"
            onClick={() => {
              useTeacher.getState().setOpen(true);
              useTour.getState().start(lesson);
            }}
          >
            ▶ {t('teacher.tour.start')}
          </button>
        )}
        {lesson.id in quizzes && (
          <button className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-950" style={{ background: lesson.accent }} onClick={() => useQuizUI.getState().open(lesson.id)}>
            {t('quiz.open')}
          </button>
        )}
        <LessonBadge lessonId={lesson.id} />
      </div>
      <TeacherPanel lesson={lesson} />
      <QuizDialog lesson={lesson} />
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
