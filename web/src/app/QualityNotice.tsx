import { useTranslation } from 'react-i18next';
import { useSettings } from '../store/settings';

/** One-time banner after we automatically switched to low graphics, with an undo. */
export function QualityNotice() {
  const { t } = useTranslation();
  const auto = useSettings((s) => s.autoDegraded);
  const dismiss = useSettings((s) => s.dismissAutoDegraded);
  const setLow = useSettings((s) => s.setLowGraphics);
  if (!auto) return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-center gap-3 border-b border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm text-amber-100">
      <span>{t('quality.switched')}</span>
      <button className="rounded border border-amber-300/60 px-2 py-0.5 hover:bg-amber-300/10" onClick={() => { setLow(false); dismiss(); }}>{t('quality.undo')}</button>
      <button className="rounded px-2 py-0.5 underline hover:text-white" onClick={dismiss}>{t('quality.ok')}</button>
    </div>
  );
}
