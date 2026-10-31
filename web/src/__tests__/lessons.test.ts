import { describe, expect, it } from 'vitest';
import { lessons, lessonBySubject, isSubject } from '../core/lessons';
import en from '../i18n/en.json';

describe('lesson registry', () => {
  it('loads one lesson per subject, ordered bio → physics → chem', () => {
    expect(lessons.map((l) => l.subject)).toEqual(['biology', 'physics', 'chemistry']);
  });
  it('has unique ids and routes that match the subject', () => {
    expect(new Set(lessons.map((l) => l.id)).size).toBe(lessons.length);
    for (const l of lessons) expect(l.route).toBe(`/lab/${l.subject}`);
  });
  it('every lesson teacher exists in i18n', () => {
    for (const l of lessons) expect(en.teachers).toHaveProperty(l.teacher);
  });
  it('type guard and lookup work', () => {
    expect(isSubject('physics')).toBe(true);
    expect(isSubject('math')).toBe(false);
    expect(lessonBySubject('chemistry')?.teacher).toBe('layla');
  });
});
