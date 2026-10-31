import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LessonMeta } from '../core/lessons';
import { teacherById } from '../core/teachers';
import { hasWebGL } from '../landing/hasWebGL';
import { useSettings } from '../store/settings';
import { useTeacher } from './store';
import { getSpeech } from './speech/webSpeech';
import { useVoiceInput } from './useVoiceInput';

const Avatar = lazy(() => import('./Avatar'));
const webgl = hasWebGL();

/** Static SVG face used on the launcher button, so no second WebGL context exists until the panel is opened. */
function FaceIcon({ look }: { look: { skin: string; hair: string; outfit: string } }) {
  return (
    <svg viewBox="0 0 40 40" className="size-full" aria-hidden>
      <rect width="40" height="40" fill={look.outfit} opacity="0.25" />
      <path d="M8 40c1-8 6-11 12-11s11 3 12 11z" fill="#f1f5f9" />
      <circle cx="20" cy="18" r="9" fill={look.skin} />
      <path d="M10.5 17c0-7 4-10 9.500-10s9.500 3 9.500 10c-3-3-6-4.500-9.500-4.500S13.500 14 10.500 17z" fill={look.hair} />
      <circle cx="16.500" cy="19" r="1.100" fill="#111827" />
      <circle cx="23.500" cy="19" r="1.100" fill="#111827" />
      <path d="M17.500 23.500q2.500 1.800 5 0" stroke="#7f1d1d" strokeWidth="1.200" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function TeacherPanel({ lesson }: { lesson: LessonMeta }) {
  const { t } = useTranslation();
  const teacher = teacherById(lesson.teacher);
  const lang = useSettings((s) => s.lang);
  const lowGraphics = useSettings((s) => s.lowGraphics);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const voiceOn = useSettings((s) => s.teacherVoice);
  const setVoiceOn = useSettings((s) => s.setTeacherVoice);
  const { open, setOpen, messages, status, mode, setMode, availability, notice, noticeVars, send, stop, clear, checkAvailability } = useTeacher();
  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [voicesTick, setVoicesTick] = useState(0);

  const name = t(`teachers.${lesson.teacher}.name`);
  const streaming = status === 'streaming';
  const offline = availability === 'offline';

  useEffect(() => {
    if (open && availability === 'unknown') void checkAvailability();
  }, [open, availability, checkAvailability]);
  useEffect(() => getSpeech().onVoicesChanged?.(() => setVoicesTick((n) => n + 1)), []);
  useEffect(() => () => useTeacher.getState().clear(), []); // leaving the lab ends the conversation and silences speech
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, notice]);

  const submit = (text: string) => {
    if (!text.trim()) return;
    setDraft('');
    void send(text, lesson);
  };
  const voice = useVoiceInput(lang, (text) => submit(text));

  if (!teacher) return null;

  const speech = getSpeech();
  void voicesTick;
  const noVoiceForLang = voiceOn && speech.supported && !speech.hasVoice(lang);
  const suggestions = t(`teacher.suggestions.${lesson.subject}`, { returnObjects: true }) as string[];
  const lastBot = [...messages].reverse().find((m) => m.role === 'assistant' && m.text);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-3 end-3 z-40 flex items-center gap-2 rounded-full border-2 bg-slate-900 py-1.5 pe-4 ps-1.5 shadow-xl hover:bg-slate-800"
        style={{ borderColor: lesson.accent }}
      >
        <span className="size-10 overflow-hidden rounded-full"><FaceIcon look={teacher.look} /></span>
        <span className="text-sm font-semibold">{t('teacher.ask', { name })}</span>
      </button>
    );
  }

  return (
    <aside
      aria-label={t('teacher.panelLabel', { name })}
      onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      className="fixed bottom-3 end-3 z-40 flex max-h-[min(40rem,82vh)] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border-2 bg-slate-900 shadow-2xl"
      style={{ borderColor: lesson.accent }}
    >
      <header className="flex items-center gap-3 border-b border-slate-700 p-2">
        <div className="size-20 shrink-0 overflow-hidden rounded-xl" style={{ background: `radial-gradient(circle at 50% 35%, ${teacher.look.accent}55, #0b1220)` }}>
          {webgl ? (
            <Suspense fallback={<FaceIcon look={teacher.look} />}>
              <Avatar teacher={teacher} reducedMotion={reducedMotion} lowGraphics={lowGraphics} />
            </Suspense>
          ) : (
            <FaceIcon look={teacher.look} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate font-bold">{name}</p>
          <p className="m-0 truncate text-xs text-slate-300">{t(`teachers.${lesson.teacher}.role`)}</p>
          <div className="mt-1 inline-flex overflow-hidden rounded-md border border-slate-600 text-xs" role="radiogroup" aria-label={t('teacher.mode.label')}>
            {(['explain', 'socratic'] as const).map((m) => (
              <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`px-2 py-0.5 ${mode === m ? 'bg-sky-400 font-semibold text-slate-900' : 'bg-slate-800 hover:bg-slate-700'}`}>
                {t(`teacher.mode.${m}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <button onClick={() => setOpen(false)} aria-label={t('teacher.close')} className="size-8 rounded-md bg-slate-800 text-lg leading-none hover:bg-slate-700">×</button>
          <button
            onClick={() => {
              setVoiceOn(!voiceOn);
              if (voiceOn) getSpeech().cancel();
            }}
            aria-pressed={voiceOn}
            aria-label={t(voiceOn ? 'teacher.voiceOn' : 'teacher.voiceOff')}
            title={t(voiceOn ? 'teacher.voiceOn' : 'teacher.voiceOff')}
            className={`size-8 rounded-md text-base hover:bg-slate-700 ${voiceOn ? 'bg-sky-400 text-slate-900' : 'bg-slate-800'}`}
          >
            <span aria-hidden>{voiceOn ? '🔊' : '🔇'}</span>
          </button>
        </div>
      </header>

      <div ref={logRef} role="log" aria-label={t('teacher.transcript')} className="min-h-24 flex-1 space-y-2 overflow-y-auto p-3 text-sm">
        {messages.length === 0 && (
          <>
            <p className="m-0 rounded-xl border-s-4 bg-slate-800 p-2" style={{ borderColor: lesson.accent }}>{t(`teacher.welcome.${lesson.teacher}`)}</p>
            {!offline && (
              <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                {suggestions.map((s) => (
                  <li key={s}><button onClick={() => submit(s)} disabled={streaming} className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700">{s}</button></li>
                ))}
              </ul>
            )}
          </>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : ''}>
            <div className={m.role === 'user' ? 'max-w-[85%] rounded-2xl bg-sky-500/90 px-3 py-1.5 text-slate-950' : 'max-w-[95%] rounded-xl border-s-4 bg-slate-800 p-2'} style={m.role === 'assistant' ? { borderColor: lesson.accent } : undefined}>
              <p className="m-0 whitespace-pre-wrap leading-relaxed">{m.text || (streaming && m.role === 'assistant' ? '…' : '')}</p>
              {m.actions.length > 0 && (
                <ul className="m-0 mt-1.5 flex list-none flex-wrap gap-1 p-0">
                  {m.actions.map((a, i) => (
                    <li key={i} className={`rounded-full px-2 py-0.5 text-[11px] ${a.ok ? 'bg-emerald-500/20 text-emerald-200' : 'bg-red-500/20 text-red-200'}`}><bdi dir="ltr">{a.label}</bdi></li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1 px-3 pb-1 text-xs">
        {offline && <p role="status" className="m-0 rounded-md bg-amber-500/15 p-2 text-amber-100">{t('teacher.offline')}</p>}
        {notice && <p role="alert" className="m-0 rounded-md bg-red-500/15 p-2 text-red-100">{t(notice, noticeVars)}</p>}
        {noVoiceForLang && <p className="m-0 text-slate-400">{t('teacher.noVoice')}</p>}
        {voice.error && <p className="m-0 text-slate-400">{t('teacher.micError')}</p>}
      </div>

      <form
        className="flex items-center gap-1.5 border-t border-slate-700 p-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
          inputRef.current?.focus();
        }}
      >
        <label className="sr-only" htmlFor="teacher-input">{t('teacher.inputLabel', { name })}</label>
        <input
          id="teacher-input"
          ref={inputRef}
          value={draft}
          maxLength={500}
          onChange={(e) => setDraft(e.target.value)}
          disabled={offline}
          placeholder={t('teacher.placeholder')}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm placeholder:text-slate-500 disabled:opacity-50"
        />
        {voice.supported && (
          <button type="button" onClick={voice.toggle} disabled={offline || streaming} aria-pressed={voice.listening} aria-label={t(voice.listening ? 'teacher.micStop' : 'teacher.mic')} title={t('teacher.mic')} className={`size-9 shrink-0 rounded-lg hover:bg-slate-700 ${voice.listening ? 'animate-pulse bg-red-500' : 'bg-slate-800'}`}>
            <span aria-hidden>🎤</span>
          </button>
        )}
        {streaming ? (
          <button type="button" onClick={stop} className="h-9 shrink-0 rounded-lg bg-slate-700 px-3 text-sm font-semibold hover:bg-slate-600">{t('teacher.stop')}</button>
        ) : (
          <button type="submit" disabled={offline || !draft.trim()} className="h-9 shrink-0 rounded-lg px-3 text-sm font-semibold text-slate-950 disabled:opacity-40" style={{ background: lesson.accent }}>{t('teacher.send')}</button>
        )}
        {messages.length > 0 && !streaming && (
          <button type="button" onClick={clear} aria-label={t('teacher.clear')} title={t('teacher.clear')} className="size-9 shrink-0 rounded-lg bg-slate-800 hover:bg-slate-700"><span aria-hidden>🗑</span></button>
        )}
      </form>
      {/* Screen readers hear each finished reply once, instead of every streamed token. */}
      <div className="sr-only" aria-live="polite">{!streaming && lastBot ? lastBot.text : ''}</div>
    </aside>
  );
}
