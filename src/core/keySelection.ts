/**
 * The player's key selection, the Type Case (REQUIREMENTS §5, DESIGN §4):
 * regions, presets and helpers. Selection is by character, so `a`/`A` and
 * `1`/`!` are separate choices.
 */
import type { KeyboardLayout, LayoutKey } from '../content/layouts/types';
import { APPRENTICE_CHAPTERS, apprenticeKeys } from './campaign';

export type RegionId = 'lowercase' | 'uppercase' | 'accents' | 'digits' | 'symbols' | 'space';

/** Every group a layout can have; `accents` is empty on layouts without accent keys (regionsFor leaves it out). */
export const REGIONS: readonly RegionId[] = ['lowercase', 'uppercase', 'accents', 'digits', 'symbols', 'space'];

/**
 * The groups this layout has keys for, in order. `accents` are the words
 * language's accented letters the player can type (core/accents.ts), which
 * join the accents group even when they have no key of their own (ê on AZERTY,
 * every accent on a US keyboard).
 */
export function regionsFor(layout: KeyboardLayout, accents: readonly string[] = []): RegionId[] {
  return REGIONS.filter((id) => regionChars(layout, id, accents).length > 0);
}

const isLetter = (ch: string) => /^\p{L}$/u.test(ch);
const isDigit = (ch: string) => /^\p{Nd}$/u.test(ch);

function allKeys(layout: KeyboardLayout): LayoutKey[] {
  return layout.rows.flat();
}

function baseChars(keys: LayoutKey[]): string[] {
  return keys.map((k) => k.base).filter((ch) => ch !== ' ');
}

/**
 * A letter key: a letter plain and its capital on Shift (`a`/`A`, `ñ`/`Ñ`).
 * AZERTY's `é` key isn't one (Shift gives `2`).
 */
function isLetterKey(key: LayoutKey): boolean {
  return isLetter(key.base) && key.shift !== undefined && key.shift !== key.base && key.shift === key.base.toUpperCase();
}

/** An accented letter: one that splits into a letter and an accent mark (`é` = `e` + ´). */
const isAccented = (ch: string) => isLetter(ch) && /\p{M}/u.test(ch.normalize('NFD'));

/**
 * Every character a key shows (plain and Shift), and which group it's in.
 * Each is in exactly one group: letter keys give lowercase and capitals;
 * accented letters on their own keys (AZERTY's é) and dead accent keys (^)
 * are accents; then digits, space, and everything else is a symbol
 * (µ, º and ² included).
 */
function keyChars(layout: KeyboardLayout): { ch: string; region: RegionId }[] {
  const out: { ch: string; region: RegionId }[] = [];
  const seen = new Set<string>();
  const add = (ch: string | undefined, region: RegionId) => {
    if (ch === undefined || seen.has(ch)) return;
    seen.add(ch);
    out.push({ ch, region });
  };
  for (const shifted of [false, true]) {
    for (const key of allKeys(layout)) {
      const level = shifted ? 'shift' : 'base';
      const ch = key[level];
      if (ch === undefined) continue;
      if (isLetterKey(key)) add(ch, shifted ? 'uppercase' : 'lowercase');
      else if (key.dead?.includes(level) || isAccented(ch)) add(ch, 'accents');
      else if (isDigit(ch)) add(ch, 'digits');
      else if (ch === ' ') add(ch, 'space');
      else add(ch, 'symbols');
    }
  }
  return out;
}

/** Characters in a region, in keyboard order: plain keys first, then shifted (then accents typed with two keys). */
export function regionChars(layout: KeyboardLayout, region: RegionId, accents: readonly string[] = []): string[] {
  const chars = keyChars(layout)
    .filter((c) => c.region === region)
    .map((c) => c.ch);
  if (region !== 'accents') return chars;
  return [...chars, ...accents.filter((ch) => !chars.includes(ch))];
}

/** The words language's accented letters that have no key of their own on this layout (the Type Case's Accents strip). */
export function strippedAccents(layout: KeyboardLayout, accents: readonly string[]): string[] {
  const onKeys = layoutChars(layout);
  return accents.filter((ch) => !onKeys.has(ch));
}

/** The symbols on the digit keys, plain or shifted (`!@#$%^&*()` on US QWERTY). */
function digitKeySymbols(layout: KeyboardLayout): string[] {
  const digitKeys = allKeys(layout).filter((k) => /^Digit\d$/.test(k.code));
  const symbols = regionChars(layout, 'symbols');
  return symbols.filter((ch) => digitKeys.some((k) => k.base === ch || k.shift === ch));
}

/** The "Letters + accents" preset's id. */
export const LETTERS_ACCENTS = 'lettersAccents';

export interface Preset {
  id: string;
  /** Characters in the preset. */
  chars: string[];
  /** Built-in presets have translated names; custom ones carry their own. */
  name?: string;
  builtIn: boolean;
}

/**
 * The home row as taught in a first typing lesson: the eight home keys and
 * the two between them, without the far-right key (`asdfghjkl;` on QWERTY).
 */
export function homeRowLesson(layout: KeyboardLayout): string[] {
  return baseChars((layout.rows[2] ?? []).slice(0, 10));
}

/**
 * Common lessons, roughly in the order a typing course teaches them. Every
 * one includes space, so real words and phrases show up; only the Apprentice
 * course (apprenticePreset) holds space back until its own chapter.
 */
export function builtInPresets(layout: KeyboardLayout, accents: readonly string[] = []): Preset[] {
  const r = (id: RegionId) => regionChars(layout, id, accents);
  const preset = (id: string, chars: string[]): Preset => ({ id, chars: [...new Set([...chars, ' '])], builtIn: true });
  const home = homeRowLesson(layout);
  const topRow = (layout.rows[1] ?? []).filter(isLetterKey).map((k) => k.base);
  const chars = layoutChars(layout);
  return [
    // The classic first lesson: the home row without the far-right key.
    preset('homeRow', home),
    preset('homeTopRows', [...home, ...topRow]),
    preset('allLetters', r('lowercase')),
    // What a brand-new player starts with (DEFAULT_KEYS in config.ts), shown as "All letters".
    preset('lettersCapitals', [...r('lowercase'), ...r('uppercase')]),
    // Spanish adds its opening ¿ ¡ (passed in with the accents).
    preset('lettersPunctuation', [...r('lowercase'), ...r('uppercase'), ...[',', '.', "'", '?', '!'].filter((ch) => chars.has(ch)), ...accents.filter((ch) => !isLetter(ch))]),
    // Accent practice, for a words language with accents: words lean towards accented ones.
    ...(accents.length > 0 ? [preset(LETTERS_ACCENTS, [...r('lowercase'), ...accents.filter(isLetter)])] : []),
    preset('numbers', r('digits')),
    preset('numberSymbols', digitKeySymbols(layout)),
    preset('symbols', r('symbols')),
    // Offered to players who do really well ("Ready for more?", core/nudges.ts).
    preset('everything', [...r('lowercase'), ...r('uppercase'), ...r('accents'), ...r('digits'), ...r('symbols')]),
  ];
}

/**
 * The keys of the Apprentice chapter a player has reached (`unlocked`
 * chapters are open, so the highest is chapter `unlocked`, 1-based). Shown
 * as a preset so Practice can always match Apprentice progress.
 */
export function apprenticePreset(layout: KeyboardLayout, unlocked: number, name: string): Preset {
  const chapter = Math.max(1, Math.min(unlocked, APPRENTICE_CHAPTERS));
  return { id: 'apprentice', name, chars: apprenticeKeys(layout, chapter - 1), builtIn: true };
}

/**
 * The player's keys after switching layout: a built-in or Apprentice preset
 * becomes the same preset on the new layout (the home row stays the home
 * row); any other selection is kept as it is.
 */
export function remapSelection(from: KeyboardLayout, to: KeyboardLayout, keys: readonly string[], unlocked: number, accents: readonly string[] = []): string[] {
  const presets = (layout: KeyboardLayout) => [apprenticePreset(layout, unlocked, ''), ...builtInPresets(layout, accents)];
  const match = matchingPreset(presets(from), keys);
  const target = match && presets(to).find((p) => p.id === match.id);
  return target ? orderedSelection(to, target.chars) : [...keys];
}

/** Every character a layout can produce. */
export function layoutChars(layout: KeyboardLayout): Set<string> {
  const out = new Set<string>();
  for (const key of allKeys(layout)) {
    out.add(key.base);
    if (key.shift) out.add(key.shift);
  }
  return out;
}

/**
 * Toggle a whole region: if every key in it is already selected, remove them
 * all; otherwise add the missing ones.
 */
export function toggleRegion(selection: ReadonlySet<string>, chars: readonly string[]): Set<string> {
  const next = new Set(selection);
  const allOn = chars.length > 0 && chars.every((ch) => next.has(ch));
  for (const ch of chars) {
    if (allOn) next.delete(ch);
    else next.add(ch);
  }
  return next;
}

/** 'all', 'some' or 'none' of a region is selected. */
export function regionState(selection: ReadonlySet<string>, chars: readonly string[]): 'all' | 'some' | 'none' {
  const on = chars.filter((ch) => selection.has(ch)).length;
  if (on === 0) return 'none';
  return on === chars.length ? 'all' : 'some';
}

/** The preset matching a selection exactly, if any. */
export function matchingPreset(presets: readonly Preset[], selection: Iterable<string>): Preset | undefined {
  const set = new Set(selection);
  return presets.find((p) => p.chars.length === set.size && p.chars.every((ch) => set.has(ch)));
}

/** Selection in a stable keyboard order, for storage and content. */
export function orderedSelection(layout: KeyboardLayout, selection: Iterable<string>): string[] {
  const set = new Set(selection);
  const order: string[] = [];
  for (const key of allKeys(layout)) {
    if (set.has(key.base)) order.push(key.base);
  }
  for (const key of allKeys(layout)) {
    if (key.shift && set.has(key.shift)) order.push(key.shift);
  }
  // Characters not on this layout (e.g. from another layout) go last.
  for (const ch of set) if (!order.includes(ch)) order.push(ch);
  return order;
}
