import { LabShell } from '../LabShell';
import { lessonBySubject } from '../../core/lessons';

// Placeholder until this lab's phase lands; the route and lazy loading are already in place.
export default function Lab() {
  const lesson = lessonBySubject('chemistry');
  return lesson ? <LabShell lesson={lesson} /> : null;
}
