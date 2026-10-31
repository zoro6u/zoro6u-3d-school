import type { TeacherId } from './lessons';

export interface TeacherDef {
  id: TeacherId;
  subject: string;
  voice: { pitch: number; rate: number };
  look: { skin: string; hair: string; outfit: string; accent: string; prop: 'clipboard' | 'glasses' | 'flask' };
}

// Persona text (used in the LLM prompt) stays on the server; the browser only needs voice + look.
const modules = import.meta.glob<TeacherDef>('../../../content/teachers/*.json', { eager: true, import: 'default' });
export const teachers: Record<string, TeacherDef> = Object.fromEntries(Object.values(modules).map((t) => [t.id, t]));
export const teacherById = (id: string): TeacherDef | undefined => teachers[id];
