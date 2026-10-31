// Lesson metadata is data, not code: it lives in /content/lessons/*/lesson.json.
export type Subject = 'biology' | 'physics' | 'chemistry';
export type TeacherId = 'nour' | 'karim' | 'layla';

export interface LessonMeta {
  id: string;
  subject: Subject;
  route: string;
  accent: string;
  teacher: TeacherId;
  status: 'planned' | 'ready';
}

const modules = import.meta.glob<LessonMeta>('../../../content/lessons/*/lesson.json', {
  eager: true,
  import: 'default',
});

const ORDER: Subject[] = ['biology', 'physics', 'chemistry'];

export const lessons: LessonMeta[] = Object.values(modules).sort(
  (a, b) => ORDER.indexOf(a.subject) - ORDER.indexOf(b.subject),
);

export function lessonBySubject(subject: Subject): LessonMeta | undefined {
  return lessons.find((l) => l.subject === subject);
}

export function isSubject(value: string | undefined): value is Subject {
  return value === 'biology' || value === 'physics' || value === 'chemistry';
}
