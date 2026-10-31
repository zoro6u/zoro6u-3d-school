import i18n from '../i18n';
import type { TeacherAction } from './tools';

/** Short label shown under a teacher message when it changed the scene, e.g. "gravity → moon". */
export function chipLabel(a: TeacherAction): string {
  switch (a.tool) {
    case 'set_param':
      return `${a.name} → ${String(a.value)}`;
    case 'focus_object':
      return i18n.t('teacher.chips.focus', { name: i18n.t(`biology.organelles.${a.id}.name`, { defaultValue: a.id }) });
    case 'play_reaction_step':
      return i18n.t('teacher.chips.step', { n: a.n + 1 });
    case 'reset_scene':
      return i18n.t('teacher.chips.reset');
  }
}
