/**
 * Player settings: comfort and accessibility options (REQUIREMENTS §10).
 * Small, so they live in localStorage (REQUIREMENTS §8) rather than the save.
 */
import type { Platform } from './content/layouts/types';
import { detectPlatform } from './input/keyboard';
import { THEMES, type ThemeId } from './render/theme';
import { LANGUAGES, languageFromTag, type Language } from './core/languages';

export type TextSize = 'normal' | 'large' | 'larger';
export type MotionSetting = 'system' | 'reduced' | 'full';

/** Screen shake and the damage flash: 'gentle' softens the shake and drops the flash. */
export type ScreenEffects = 'full' | 'gentle';
export const SCREEN_EFFECTS: readonly ScreenEffects[] = ['full', 'gentle'];

/** The faint manuscript and its scribe behind play: 'off' leaves a plain page (the heading stays). */
export type PageWriting = 'on' | 'off';
export const PAGE_WRITING: readonly PageWriting[] = ['on', 'off'];

/** Holiday looks (core/seasons.ts): decor, creature hats and holiday words in season. Desk items you own work either way. */
export type HolidayLooks = 'on' | 'off';
export const HOLIDAY_LOOKS: readonly HolidayLooks[] = ['on', 'off'];

/** Which kind of computer: Macs have Option instead of AltGr and move a few keys (content/layouts). */
export const KEYBOARD_KINDS: readonly Platform[] = ['mac', 'pc'];

export const TEXT_SIZES: readonly TextSize[] = ['normal', 'large', 'larger'];
export const MOTION_SETTINGS: readonly MotionSetting[] = ['system', 'reduced', 'full'];

/** How much bigger targets and their text get. */
export const TEXT_SCALE: Record<TextSize, number> = { normal: 1, large: 1.2, larger: 1.4 };

export interface Settings {
  /** Language of menus and messages on this device; from the browser language the first time. */
  menuLanguage: Language;
  textSize: TextSize;
  theme: ThemeId;
  motion: MotionSetting;
  screenEffects: ScreenEffects;
  pageWriting: PageWriting;
  holidayLooks: HolidayLooks;
  /** Mac or PC keys, for the keyboard picture and key help; detected the first time. */
  keyboardKind: Platform;
  /** Sound effects volume, 0..1. */
  volume: number;
  muted: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  menuLanguage: languageFromTag(globalThis.navigator?.language),
  textSize: 'normal',
  theme: 'classic',
  motion: 'system',
  screenEffects: 'full',
  pageWriting: 'on',
  holidayLooks: 'on',
  keyboardKind: detectPlatform(),
  volume: 0.6,
  muted: false,
};

// Keeps the game's first name (Inkling) so players don't lose their settings.
const STORAGE_KEY = 'inkling.settings';

/** Validate whatever was stored, keeping good fields and defaulting the rest. */
export function parseSettings(raw: unknown): Settings {
  const s = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback;
  const volume = typeof s.volume === 'number' && Number.isFinite(s.volume) ? Math.min(1, Math.max(0, s.volume)) : DEFAULT_SETTINGS.volume;
  return {
    menuLanguage: pick(s.menuLanguage, LANGUAGES, DEFAULT_SETTINGS.menuLanguage),
    textSize: pick(s.textSize, TEXT_SIZES, DEFAULT_SETTINGS.textSize),
    theme: pick(s.theme, THEMES, DEFAULT_SETTINGS.theme),
    motion: pick(s.motion, MOTION_SETTINGS, DEFAULT_SETTINGS.motion),
    screenEffects: pick(s.screenEffects, SCREEN_EFFECTS, DEFAULT_SETTINGS.screenEffects),
    pageWriting: pick(s.pageWriting, PAGE_WRITING, DEFAULT_SETTINGS.pageWriting),
    holidayLooks: pick(s.holidayLooks, HOLIDAY_LOOKS, DEFAULT_SETTINGS.holidayLooks),
    keyboardKind: pick(s.keyboardKind, KEYBOARD_KINDS, DEFAULT_SETTINGS.keyboardKind),
    volume,
    muted: typeof s.muted === 'boolean' ? s.muted : DEFAULT_SETTINGS.muted,
  };
}

/** Read settings. Storage can be blocked (private windows), so fall back to defaults. */
export function loadSettings(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): Settings {
  try {
    const text = storage?.getItem(STORAGE_KEY);
    return parseSettings(text ? JSON.parse(text) : {});
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings, storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Not fatal: the settings just won't be remembered.
  }
}

/** Resolve the motion setting against the OS preference. */
export function reducedMotion(settings: Settings, osPrefersReduced: boolean): boolean {
  return settings.motion === 'system' ? osPrefersReduced : settings.motion === 'reduced';
}
