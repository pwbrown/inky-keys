import { en, type MessageKey } from './en';
import { fr } from './fr';
import { DEFAULT_LANGUAGE, languageFromTag, type Language } from '../core/languages';

export type { MessageKey };
export type MessageParams = Record<string, string | number>;

/** Release notes may be missing in a translation (they fall back to English per key); nothing else may. */
export type ReleaseKey = Extract<MessageKey, `release.${string}`>;
export type Messages = Record<Exclude<MessageKey, ReleaseKey>, string> & Partial<Record<ReleaseKey, string>>;

const locales: Record<Language, Messages> = { en, fr };
let active: Messages = en;
let activeLocale: Language = DEFAULT_LANGUAGE;

/** Switch the menu language. Unknown languages (or "fr-CA" style tags of them) fall back sensibly. */
export function setLocale(locale: string): void {
  activeLocale = languageFromTag(locale);
  active = locales[activeLocale];
}

export function getLocale(): Language {
  return activeLocale;
}

function fill(template: string, params: MessageParams): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** Look up a UI string and fill in `{placeholders}`. */
export function t(key: MessageKey, params: MessageParams = {}): string {
  return fill((active as Partial<Record<MessageKey, string>>)[key] ?? en[key], params);
}

/** Message keys that come in plural forms: `base.one`, `base.other` (and any others a language needs). */
export type CountKey = { [K in MessageKey]: K extends `${infer Base}.other` ? Base : never }[MessageKey];

/**
 * A message that depends on a number, picked with Intl.PluralRules for the
 * menu language (French treats 0 like 1; English doesn't). Falls back to `.other`.
 * `{count}` is filled with the number unless `params` gives it.
 */
export function tCount(base: CountKey, n: number, params: MessageParams = {}): string {
  const rule = new Intl.PluralRules(activeLocale).select(n);
  const key = `${base}.${rule}` as MessageKey;
  const pick = key in en ? key : (`${base}.other` as MessageKey);
  return t(pick, { count: n, ...params });
}

/** Locale-aware number formatting via Intl. */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(activeLocale, options).format(value);
}
