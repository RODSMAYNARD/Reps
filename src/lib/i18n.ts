import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { useSyncExternalStore } from 'react';
import { PT } from '../i18n/pt';

/**
 * Idiomas da interface. O código é escrito em inglês e o texto é traduzido na hora de desenhar
 * (`components/Text.tsx` traduz os filhos de texto; `tr` serve para títulos de abas, placeholders e afins).
 * Texto sem tradução aparece em inglês. Para um idioma novo: um dicionário em `src/i18n/<código>.ts` + uma entrada em LANGS.
 */
export type LangPref = 'system' | 'en' | 'pt';
export type Lang = Exclude<LangPref, 'system'>;
export const LANGS: { id: LangPref; label: string }[] = [
  { id: 'system', label: 'Automatic (system)' },
  { id: 'en', label: 'English' },
  { id: 'pt', label: 'Português (Brasil)' },
];
const DICTS: Record<Lang, Record<string, string> | null> = { en: null, pt: PT };

const deviceLang = (): Lang => {
  try { return getLocales()[0]?.languageCode === 'pt' ? 'pt' : 'en'; } catch { return 'en'; }
};

let pref: LangPref = 'system';
let lang: Lang = deviceLang();
const listeners = new Set<() => void>();
const KEY = 'reps:lang';

/** Lê a preferência salva no aparelho (chamado uma vez ao abrir o app). */
export const loadLang = async () => {
  const v = (await AsyncStorage.getItem(KEY).catch(() => null)) as LangPref | null;
  if (v === 'en' || v === 'pt' || v === 'system') setLangPref(v, false);
};

export const setLangPref = (p: LangPref, save = true) => {
  pref = p;
  lang = p === 'system' ? deviceLang() : p;
  if (save) AsyncStorage.setItem(KEY, p).catch(() => {});
  listeners.forEach((l) => l());
};

export const getLangPref = () => pref;
export const getLang = () => lang;

/** Idioma efetivo; a tela que usa redesenha quando ele muda. */
export const useLang = () => useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => lang, () => lang);

/** Traduz um texto da interface (mantém espaços nas pontas). Sem tradução, devolve o original. */
export const tr = (s: string): string => {
  const d = DICTS[lang];
  if (!d) return s;
  const t = s.trim();
  if (!t) return s;
  const hit = d[t];
  return hit == null ? s : s.replace(t, hit);
};

/** Locale para datas e números (`toLocaleDateString` etc.). */
export const locale = () => (lang === 'pt' ? 'pt-BR' : 'en-US');
