/**
 * Languages the game can show menus in and give words in (REQUIREMENTS §13d).
 * Menu language is per device (settings.ts); words language is per player (the save).
 */
export const LANGUAGES = ['en', 'fr'] as const;
export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'en';

export function isLanguage(v: unknown): v is Language {
  return LANGUAGES.includes(v as Language);
}

/** The best language for a BCP 47 tag such as navigator.language ("fr-CA" → fr), or English. */
export function languageFromTag(tag: string | undefined): Language {
  const base = (tag ?? '').toLowerCase().split('-')[0];
  return isLanguage(base) ? base : DEFAULT_LANGUAGE;
}

/** Each language's own name, the same in every menu language so players can always find theirs. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', fr: 'Français' };
