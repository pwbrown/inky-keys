/**
 * How to type accented letters (REQUIREMENTS §13d, "Typing accents"): the
 * key steps the accent chapters, briefings, creature tags and the accent
 * help card all draw from. Pure data, no DOM.
 *
 * - Layouts with dead keys (AZERTY, Spanish ISO) use their own keys and
 *   compose table: on AZERTY `é` is a key, `ê` is `^` then `e`.
 * - Layouts without (US QWERTY, Dvorak, Colemak) use the computer's own
 *   accent method: Option keys on a Mac, US-International on Windows or a
 *   Chromebook.
 */
import { findDeadKey, findKey, findKeyLevel } from '../content/layouts/ansi';
import type { KeyboardLayout, KeyLevel, LayoutKey, Platform } from '../content/layouts/types';
import type { Language } from './languages';

/** One key press, with the modifiers held for it. */
export interface KeyStep {
  /** KeyboardEvent.code of the physical key. */
  code: string;
  /** What's printed on the key (its plain character), for drawing a keycap. */
  key: string;
  /** The key's Shift character, printed above, when it isn't just the capital (2 above é on AZERTY). */
  top?: string;
  shift?: true;
  altGr?: true;
  /** The Mac Option key. */
  option?: true;
  /** This press waits for the next one (a dead key): nothing appears yet. */
  dead?: true;
  /** What this press gives: the accent a dead key waits with (^), or the character typed. */
  makes: string;
}

/** Which method the steps use, for the help card's explanation. */
export type AccentMethod = 'layout' | 'macOption' | 'usInternational';

/**
 * The accented letters each words language uses, in the Contents page's
 * "Accents" chapters (the order they're taught). English has none.
 */
export const ACCENT_CHAPTERS: Readonly<Record<Language, readonly (readonly string[])[]>> = {
  en: [],
  fr: [['é'], ['è', 'à', 'ù'], ['ç'], ['â', 'ê', 'î', 'ô', 'û'], ['ë', 'ï', 'ü']],
};

/** Every accented letter of a language, in teaching order. */
export function accentedLetters(lang: Language): string[] {
  return ACCENT_CHAPTERS[lang].flat();
}

/** True for a letter with an accent (or cedilla): é, ç, Ê… */
export function isAccented(char: string): boolean {
  return plainLetter(char) !== char;
}

/** The letter without its accent (é → e, Ç → C), for Forgiving accents. */
export function plainLetter(char: string): string {
  return char.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');
}

/** The accent marks typed with a dead key, and the letters they combine with in each method. */
type Mark = 'acute' | 'grave' | 'circumflex' | 'diaeresis' | 'tilde';

const MARK_OF: Record<string, Mark> = {};
for (const [mark, letters] of Object.entries({
  acute: 'áéíóúÁÉÍÓÚ',
  grave: 'àèìòùÀÈÌÒÙ',
  circumflex: 'âêîôûÂÊÎÔÛ',
  diaeresis: 'äëïöüÿÄËÏÖÜ',
  tilde: 'ãñõÃÑÕ',
}) as [Mark, string][]) {
  for (const ch of letters) MARK_OF[ch] = mark;
}

const LEVEL_MODS: Record<KeyLevel, Pick<KeyStep, 'shift' | 'altGr'>> = {
  base: {},
  shift: { shift: true },
  altGr: { altGr: true },
  altGrShift: { shift: true, altGr: true },
};

function step(key: LayoutKey, level: KeyLevel, extra: Partial<KeyStep> = {}): KeyStep {
  const top = key.shift && key.shift !== key.base.toUpperCase() ? { top: key.shift } : {};
  return { code: key.code, key: key.base, ...top, ...LEVEL_MODS[level], makes: key[level] ?? key.base, ...extra };
}

/** The mark a dead key shows while it waits, by accent. */
const MARK_CHAR: Record<Mark, string> = { acute: '´', grave: '`', circumflex: '^', diaeresis: '¨', tilde: '~' };

/** The key that types `char` without modifiers or with Shift, as a step (with Shift if needed). */
function plainStep(layout: KeyboardLayout, char: string, extra: Partial<KeyStep> = {}): KeyStep | null {
  const key = findKey(layout, char);
  if (!key) return null;
  return step(key, key.base === char ? 'base' : 'shift', extra);
}

/** A layout with no dead keys of its own types accents the way the computer does for a US keyboard. */
function usesComputerMethod(layout: KeyboardLayout): boolean {
  return Object.keys(layout.compose).length === 0;
}

/** Which method `howToType` uses for this layout and computer. */
export function accentMethod(layout: KeyboardLayout, platform: Platform): AccentMethod {
  if (!usesComputerMethod(layout)) return 'layout';
  return platform === 'mac' ? 'macOption' : 'usInternational';
}

/** From the layout itself: a key of its own, or a dead key then a letter. */
function layoutSteps(layout: KeyboardLayout, char: string): KeyStep[] | null {
  const direct = findKeyLevel(layout, char);
  if (direct) return [step(direct.key, direct.level)];
  for (const [mark, table] of Object.entries(layout.compose)) {
    const base = Object.keys(table).find((k) => table[k] === char && k !== ' ');
    if (base === undefined) continue;
    const dead = findDeadKey(layout, mark);
    const letter = findKeyLevel(layout, base);
    if (dead && letter) return [step(dead.key, dead.level, { dead: true }), step(letter.key, letter.level, { makes: char })];
  }
  return null;
}

/** Mac, US-style layout: Option+e then the letter, and so on. */
function macSteps(layout: KeyboardLayout, char: string): KeyStep[] | null {
  const direct: Record<string, [string, boolean]> = { ç: ['c', false], Ç: ['c', true], '¡': ['1', false], '¿': ['/', true] };
  const d = direct[char];
  if (d) {
    const s = plainStep(layout, d[0], { option: true, makes: char });
    return s ? [{ ...s, ...(d[1] ? { shift: true } : {}) }] : null;
  }
  const mark = MARK_OF[char];
  if (!mark) return null;
  const deadChar = { acute: 'e', grave: '`', circumflex: 'i', diaeresis: 'u', tilde: 'n' }[mark];
  const dead = plainStep(layout, deadChar, { option: true, dead: true, makes: MARK_CHAR[mark] });
  const letter = plainStep(layout, plainLetter(char), { makes: char });
  return dead && letter ? [{ ...dead, shift: undefined }, letter].map(clean) : null;
}

/** Windows or Chromebook, US-International: ' then the letter, and so on. */
function usInternationalSteps(layout: KeyboardLayout, char: string): KeyStep[] | null {
  // AltGr keys of US-International that type the letter directly.
  const direct: Record<string, [string, boolean]> = { ç: [',', false], Ç: [',', true], ñ: ['n', false], Ñ: ['n', true], '¡': ['1', false], '¿': ['/', false] };
  const d = direct[char];
  if (d) {
    const s = plainStep(layout, d[0], { altGr: true, makes: char });
    return s ? [clean({ ...s, shift: d[1] ? true : undefined })] : null;
  }
  const mark = MARK_OF[char];
  if (!mark) return null;
  const deadChar = { acute: "'", grave: '`', circumflex: '^', diaeresis: '"', tilde: '~' }[mark];
  const dead = plainStep(layout, deadChar, { dead: true, makes: MARK_CHAR[mark] });
  const letter = plainStep(layout, plainLetter(char));
  return dead && letter ? [dead, { ...letter, makes: char }] : null;
}

function clean(s: KeyStep): KeyStep {
  const out = { ...s };
  for (const k of ['shift', 'altGr', 'option', 'dead'] as const) if (!out[k]) delete out[k];
  return out;
}

/**
 * The key presses that type `char` on this layout and computer, in order,
 * or null if it can't be typed there (e.g. `É` on Windows AZERTY). `layout`
 * is the platform's variant (layoutById / forPlatform).
 */
export function howToType(char: string, layout: KeyboardLayout, platform: Platform): KeyStep[] | null {
  const own = layoutSteps(layout, char);
  if (own) return own;
  if (!usesComputerMethod(layout)) return null;
  return platform === 'mac' ? macSteps(layout, char) : usInternationalSteps(layout, char);
}

/**
 * Key presses beyond the one a plain letter takes: each extra step, and
 * each modifier held, counts one (`ê` on AZERTY is 1; `é` on a US Mac is 2).
 * Characters that can't be typed count 0 (they're never asked for).
 */
export function extraPresses(char: string, layout: KeyboardLayout, platform: Platform): number {
  const steps = howToType(char, layout, platform);
  if (!steps) return 0;
  const presses = steps.reduce((sum, s) => sum + 1 + (s.shift ? 1 : 0) + (s.altGr ? 1 : 0) + (s.option ? 1 : 0), 0);
  // A capital's Shift is counted as for any capital, not as accent work.
  const plain = char === char.toLowerCase() ? 1 : 2;
  return Math.max(0, presses - plain);
}

const costCache = new WeakMap<KeyboardLayout, Map<string, number>>();

/**
 * `extraPresses` as a fast lookup for one layout and computer, for ranking a
 * whole word list (each character is worked out once).
 */
export function pressCostFor(layout: KeyboardLayout, platform: Platform): (ch: string) => number {
  let cache = costCache.get(layout);
  if (!cache) costCache.set(layout, (cache = new Map()));
  const memo = cache;
  return (ch) => {
    // Plain a–z and most symbols are one press; only letters with marks are worked out.
    if (ch < 'À') return 0;
    const key = platform + ch;
    let cost = memo.get(key);
    if (cost === undefined) memo.set(key, (cost = extraPresses(ch, layout, platform)));
    return cost;
  };
}
