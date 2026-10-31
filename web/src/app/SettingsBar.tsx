import { useTranslation } from 'react-i18next';
import { useSettings } from '../store/settings';

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm" title={hint}>
      <input type="checkbox" className="size-4 accent-sky-400" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function SettingsBar() {
  const { t } = useTranslation();
  const s = useSettings();
  return (
    <div role="group" aria-label={t('settings.language')} className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <div className="inline-flex overflow-hidden rounded-lg border border-slate-600" role="radiogroup" aria-label={t('settings.language')}>
        {(['en', 'ar'] as const).map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={s.lang === l}
            lang={l}
            onClick={() => s.setLang(l)}
            className={`px-3 py-1 text-sm ${s.lang === l ? 'bg-sky-400 font-semibold text-slate-900' : 'bg-slate-800 hover:bg-slate-700'}`}
          >
            {t(l === 'en' ? 'settings.english' : 'settings.arabic')}
          </button>
        ))}
      </div>
      <Toggle label={t('settings.lowGraphics')} hint={t('settings.lowGraphicsHint')} checked={s.lowGraphics} onChange={s.setLowGraphics} />
      <Toggle label={t('settings.reducedMotion')} checked={s.reducedMotion} onChange={s.setReducedMotion} />
    </div>
  );
}
