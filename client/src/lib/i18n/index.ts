import { writable, derived } from 'svelte/store';
import { en } from './en.js';
import { es } from './es.js';

const translations: Record<string, Record<string, string>> = { en, es };

export type Locale = 'en' | 'es';

function getInitialLocale(): Locale {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('rps-locale');
    if (saved === 'en' || saved === 'es') return saved;
  }
  return 'en';
}

export const locale = writable<Locale>(getInitialLocale());

locale.subscribe((v) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('rps-locale', v);
  }
});

export const t = derived(locale, ($locale) => {
  const dict = translations[$locale];
  return (key: string, params?: Record<string, string>): string => {
    let str = dict[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replaceAll(`{${k}}`, v);
      }
    }
    return str;
  };
});
