"use client";

/* App language (Danish default, English alternative). The preference lives in
   localStorage for instant switching and is mirrored to profiles.language for
   cross-device + server (agent) use. `t()` looks up the Danish source string
   in the English dictionary, falling back to Danish when untranslated. */

import * as React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { EN } from './strings';
import { isAppLanguage, type AppLanguage } from '@/lib/db/types';

export type Lang = AppLanguage;

/**
 * The language registry. Danish is the source language, so it has no
 * dictionary — its "translations" are the source strings themselves. To add
 * a language: add its code to APP_LANGUAGES (db/types.ts), then add one row
 * here with a `dict` mapping the Danish source strings. translate(), both
 * language switches, and the stored-preference guard all read from here, so
 * nothing else needs touching.
 */
export interface LanguageDef { code: Lang; label: string; dict?: Record<string, string>; }
export const LANGUAGES: LanguageDef[] = [
  { code: 'da', label: 'Dansk' },
  { code: 'en', label: 'English', dict: EN },
];

const DICTIONARIES = new Map<Lang, Record<string, string>>(
  LANGUAGES.flatMap((l) => (l.dict ? [[l.code, l.dict] as const] : [])),
);

type Translate = (s: string, params?: Record<string, string | number>) => string;
/** `one` when n is 1, `other` otherwise; both get {n}. Danish and English
 *  split the same way, so two forms cover every registered language. */
type TranslateCount = (n: number, one: string, other: string, params?: Record<string, string | number>) => string;
interface LangCtx { lang: Lang; setLang: (l: Lang) => void; t: Translate; tn: TranslateCount }

export function translate(lang: Lang, s: string, params?: Record<string, string | number>): string {
  const dict = DICTIONARIES.get(lang); // undefined for the source language (da)
  let out = dict ? (dict[s] ?? s) : s;
  if (params) for (const k of Object.keys(params)) out = out.split(`{${k}}`).join(String(params[k]));
  return out;
}

export function translateCount(
  lang: Lang, n: number, one: string, other: string, params?: Record<string, string | number>,
): string {
  return translate(lang, n === 1 ? one : other, { n, ...params });
}

const Ctx = createContext<LangCtx | null>(null);

export function persistLanguage(l: Lang) {
  try { localStorage.setItem('kalas_lang', l); } catch { /* ignore */ }
  fetch('/api/profile', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: l }),
  }).catch(() => {});
}

export function LanguageProvider({ initialLang = 'da', lock = false, children }: { initialLang?: Lang; lock?: boolean; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  // The public wedding site locks to the couple's language and ignores the
  // viewer's stored preference; the app follows localStorage.
  useEffect(() => {
    if (lock) return;
    try {
      const stored = localStorage.getItem('kalas_lang');
      if (isAppLanguage(stored)) setLangState(stored);
    } catch { /* ignore */ }
  }, [lock]);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    persistLanguage(l);
  }, []);

  const t = useCallback<Translate>((s, params) => translate(lang, s, params), [lang]);
  const tn = useCallback<TranslateCount>((n, one, other, params) => translateCount(lang, n, one, other, params), [lang]);
  const value = useMemo<LangCtx>(() => ({ lang, setLang, t, tn }), [lang, setLang, t, tn]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Safe outside a provider: returns Danish source strings and a no-op setter. */
export function useLang(): LangCtx {
  const ctx = useContext(Ctx);
  if (ctx) return ctx;
  return {
    lang: 'da', setLang: () => {},
    t: (s, params) => translate('da', s, params),
    tn: (n, one, other, params) => translateCount('da', n, one, other, params),
  };
}

/* ── Presentational language switch (one pill per registered language) ─── */
export function LangSwitch({ lang, onSelect, className }: { lang: Lang; onSelect: (l: Lang) => void; className?: string }) {
  return (
    <div className={`inline-flex items-center rounded-full border border-line-strong p-0.5 ${className ?? ''}`}>
      {LANGUAGES.map(({ code, label }) => (
        <button key={code} type="button" onClick={() => onSelect(code)}
          className={`rounded-full px-3 py-1.5 text-[0.78rem] font-medium transition-colors cursor-pointer ${
            lang === code ? 'bg-ink text-canvas' : 'text-ink-soft hover:text-ink'
          }`}>
          {label}
        </button>
      ))}
    </div>
  );
}
