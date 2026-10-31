import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import ar from './ar.json';
import { dirFor, useSettings, type Lang } from '../store/settings';

/** Keep <html lang/dir> in sync so Tailwind logical utilities and native controls mirror correctly. */
export function applyDocumentLang(lang: Lang): void {
  document.documentElement.lang = lang;
  document.documentElement.dir = dirFor(lang);
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ar: { translation: ar } },
  lng: useSettings.getState().lang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

applyDocumentLang(useSettings.getState().lang);
useSettings.subscribe((s, prev) => {
  if (s.lang !== prev.lang) {
    void i18n.changeLanguage(s.lang);
    applyDocumentLang(s.lang);
  }
});

export default i18n;
