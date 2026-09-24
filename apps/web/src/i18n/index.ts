import en, { type Dictionary } from './dictionaries/en';
import ptBR from './dictionaries/pt-BR';

export const LOCALES = ['pt-BR', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'pt-BR';
export const LOCALE_COOKIE = 'locale';

const dictionaries: Record<Locale, Dictionary> = { 'pt-BR': ptBR, en };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

type Params = Record<string, string | number>;

/** Dot-path lookup with `{param}` interpolation. Missing keys return the key itself so they are easy to spot. */
export function translate(dict: Dictionary, key: string, params?: Params): string {
  const value = key.split('.').reduce<unknown>((acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined), dict);
  if (typeof value !== 'string') return key;
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (_, name: string) => (params[name] !== undefined ? String(params[name]) : `{${name}}`));
}

export type Translate = (key: string, params?: Params) => string;

export function makeT(locale: Locale): Translate {
  const dict = getDictionary(locale);
  return (key, params) => translate(dict, key, params);
}

/** Human-readable status label, falling back to a title-cased version of the raw value. */
export function statusLabelFor(t: Translate, status: string) {
  const label = t(`status.${status}`);
  return label === `status.${status}` ? status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : label;
}

export const LOCALE_NAMES: Record<Locale, string> = { 'pt-BR': 'Português', en: 'English' };
export const LOCALE_SHORT: Record<Locale, string> = { 'pt-BR': 'PT', en: 'EN' };
