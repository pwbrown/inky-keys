/**
 * The save file: everything Inky Keys keeps on the device (REQUIREMENTS §8).
 * It never leaves the device unless the player exports it themselves.
 *
 * Bump SAVE_VERSION and add a step to `MIGRATIONS` whenever the shape
 * changes, so older saves (and exported backups) keep loading.
 */
import { APPRENTICE_CHAPTERS, type GameMode } from '../core/campaign';
import { BOSS_KINDS, DEFAULT_DIFFICULTY, DEFAULT_KEYS, DIFFICULTIES, GAME_CONFIG, type BossKind, type Difficulty } from '../core/config';
import { isStickerId } from '../core/stickers';
import { isPassageId } from '../core/fairCopy';
import { isMechanic } from '../core/mechanics';
import type { Grade } from '../core/grade';
import { DEFAULT_NUDGES, type NudgeState } from '../core/nudges';
import { DEFAULT_COSMETICS, UNLOCKS, type Cosmetics } from '../core/rewards';
import { DEFAULT_LAYOUT_ID, isLayoutId } from '../content/layouts';
import type { LayoutId } from '../content/layouts/types';
import { DEFAULT_LANGUAGE, LANGUAGES, isLanguage, type Language } from '../core/languages';

export const SAVE_VERSION = 16;

export interface KeyStat {
  /** Times typed correctly. */
  hits: number;
  /** Times missed (see input.ts for how misses are attributed). */
  misses: number;
}

export interface SavedPreset {
  id: string;
  name: string;
  chars: string[];
}

/** A notebook in progress, saved at the start of each page so it can be continued. */
export interface SavedNotebook {
  /** Added in version 3; older saves were all Practice. */
  mode: GameMode;
  difficulty: Difficulty;
  /** Chapter and page to resume at (0-based). */
  chapter: number;
  page: number;
  ink: number;
  score: number;
  correct: number;
  errors: number;
  destroyed: number;
  bestCombo: number;
  playMs: number;
  /** Ability charges and held passives when the page began (added in version 7). */
  charges: number;
  eraser: boolean;
  shield: boolean;
  /** ISO timestamp. */
  savedAt: string;
}

/** A downloaded topic word list (REQUIREMENTS §6, optional vocabulary fetch). */
export interface VocabList {
  id: string;
  /** The words language it was downloaded for (added in version 16; older lists are English). */
  lang: Language;
  topic: string;
  words: string[];
  /** Whether its words are used in the game. */
  enabled: boolean;
  /** ISO timestamp. */
  fetchedAt: string;
}

/** Apprentice campaign progress (added in version 3). */
export interface ApprenticeProgress {
  /** How many chapters are open to play (at least 1). */
  unlocked: number;
  /** Best stars (1–3) per page, keyed "chapter-page" (see starKey). */
  stars: Record<string, number>;
  /** The last chapter has been finished at least once. */
  completed: boolean;
  /** Best stars per accent chapter (up to 3 a page), by words language (added in version 16). Index = chapter (0-based); 0 = not yet played. */
  accentStars: Partial<Record<Language, number[]>>;
}

/** Accent options and what's been taught (added in version 16). */
export interface AccentProgress {
  /** Let a plain letter count for its accented one (e for é). Off by default. */
  forgiving: boolean;
  /** Accented letters this player has been shown how to type. */
  seen: string[];
}

/** Ink earned (XP) and equipped cosmetics (added in version 4). */
export interface Progression {
  /** Total ink earned; level and rank follow from it. */
  ink: number;
  cosmetics: Cosmetics;
}

export interface Records {
  bestScore: Partial<Record<Difficulty, number>>;
  /** Highest chapter reached (1-based). */
  furthestChapter: Partial<Record<Difficulty, number>>;
  /** Best score on each page, keyed "mode:difficulty:chapter-page" (see pageBestKey; added in version 9). */
  pageBest: Record<string, number>;
}

/** How one Daily Page went (core/daily.ts). */
export interface DailyResult {
  score: number;
  /** Grade of each page cleared, in order. */
  grades: Grade[];
  wpm: number;
  /** Percent, 0–100. */
  accuracy: number;
  /** Every page was cleared (not out of ink or left early). */
  finished: boolean;
  /** Forgiving accents was on (added in version 16; absent means off). */
  forgiving?: true;
}

/** The sticker book (core/stickers.ts; added in version 10). */
export interface StickerBook {
  /** When each sticker was earned (ISO timestamp), by id. */
  earned: Record<string, string>;
  /** Earned but not yet looked at in the book, shown as new. */
  unseen: string[];
  /** Boss kinds beaten at least once. */
  bossesBeaten: BossKind[];
}

/** A best Fair Copy result. */
export interface FairCopyBest {
  /** Net words per minute. */
  wpm: number;
  /** 0..1. */
  accuracy: number;
  /** ISO timestamp. */
  at: string;
}

/** Fair Copy results (core/fairCopy.ts; added in version 14). */
export interface FairCopyProgress {
  /** Tests finished. */
  tests: number;
  /** Best net speed for each kind of test: `passage`, or a timed test's seconds ("30", "60"). */
  best: Record<string, FairCopyBest>;
  /** Passages (ids) copied out to the end at least once (added in version 15). */
  copied: string[];
}

/**
 * Which kinds of Fair Copy test have a best: a whole passage, or a timed
 * length, kept per words language. English keys are as they always were
 * ("passage", "60"); others are prefixed ("fr:passage").
 */
export function fairCopyKey(seconds: number | null, lang: Language = DEFAULT_LANGUAGE): string {
  const kind = seconds === null ? 'passage' : String(seconds);
  return lang === DEFAULT_LANGUAGE ? kind : `${lang}:${kind}`;
}

const FAIR_COPY_KEYS: readonly string[] = LANGUAGES.flatMap((lang) => [
  fairCopyKey(null, lang),
  ...GAME_CONFIG.fairCopy.timedSeconds.map((s) => fairCopyKey(s, lang)),
]);

/** Daily Page history (added in version 9). */
export interface DailyProgress {
  /** The last Daily Page played (its number), or null. */
  lastId: number | null;
  /** Days in a row played, up to lastId. */
  streak: number;
  bestStreak: number;
  best: number;
  /** Recent results, keyed by Daily Page number (the oldest are dropped). */
  results: Record<string, DailyResult>;
}

export interface SaveData {
  version: typeof SAVE_VERSION;
  keys: string[];
  difficulty: Difficulty;
  customPresets: SavedPreset[];
  keyStats: Record<string, KeyStat>;
  records: Records;
  notebook: SavedNotebook | null;
  /** Added in version 2. */
  vocab: VocabList[];
  /** Added in version 3. */
  apprentice: ApprenticeProgress;
  /** Added in version 4. */
  profile: Progression;
  /** Which mechanics this player has been shown, and whether to show more (added in version 7). */
  tutorials: Tutorials;
  /** The keyboard layout this player types on (added in version 8). */
  layout: LayoutId;
  /** Added in version 9. */
  daily: DailyProgress;
  /** Added in version 10. */
  stickers: StickerBook;
  /** "Ready for more?" suggestions (added in version 13). */
  nudges: NudgeState;
  /** Added in version 14. */
  fairCopy: FairCopyProgress;
  /** The language words come in for this player (added in version 16). */
  wordsLanguage: Language;
  /** Added in version 16. */
  accents: AccentProgress;
}

export interface Tutorials {
  /** Show a briefing before a page that has something new. */
  enabled: boolean;
  /** Mechanic ids (core/mechanics.ts) already explained. */
  seen: string[];
}

/** File format for export/import. */
export interface SaveExport {
  /** The game's first name (Inkling), kept so every export, old or new, imports. */
  app: 'inkling';
  exportedAt: string;
  save: SaveData;
}

export class SaveFormatError extends Error {
  constructor(
    message: string,
    /** 'invalid' = not an Inky Keys save; 'newer' = made by a newer version of the game. */
    readonly reason: 'invalid' | 'newer' = 'invalid',
  ) {
    super(message);
    this.name = 'SaveFormatError';
  }
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    keys: [...DEFAULT_KEYS],
    difficulty: DEFAULT_DIFFICULTY,
    customPresets: [],
    keyStats: {},
    records: { bestScore: {}, furthestChapter: {}, pageBest: {} },
    notebook: null,
    vocab: [],
    apprentice: { unlocked: 1, stars: {}, completed: false, accentStars: {} },
    profile: { ink: 0, cosmetics: { ...DEFAULT_COSMETICS } },
    tutorials: { enabled: true, seen: [] },
    layout: DEFAULT_LAYOUT_ID,
    daily: defaultDaily(),
    stickers: { earned: {}, unseen: [], bossesBeaten: [] },
    nudges: { ...DEFAULT_NUDGES },
    fairCopy: { tests: 0, best: {}, copied: [] },
    wordsLanguage: DEFAULT_LANGUAGE,
    accents: { forgiving: false, seen: [] },
  };
}

export function defaultDaily(): DailyProgress {
  return { lastId: null, streak: 0, bestStreak: 0, best: 0, results: {} };
}

// --- Validation -------------------------------------------------------------
// Saves come from IndexedDB or from files the player imports, so every field
// is checked rather than trusted.

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const isDifficulty = (v: unknown): v is Difficulty => DIFFICULTIES.includes(v as Difficulty);
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
/** A single character (one code point), as the game uses for keys. */
const isChar = (v: unknown): v is string => typeof v === 'string' && [...v].length === 1;

function chars(v: unknown): string[] {
  return Array.isArray(v) ? [...new Set(v.filter(isChar))] : [];
}

function difficultyRecord(v: unknown): Partial<Record<Difficulty, number>> {
  const out: Partial<Record<Difficulty, number>> = {};
  if (isObject(v)) for (const d of DIFFICULTIES) if (d in v) out[d] = count(v[d]);
  return out;
}

function sanitizeNotebook(v: unknown): SavedNotebook | null {
  if (!isObject(v) || !isDifficulty(v.difficulty)) return null;
  return {
    mode: v.mode === 'apprentice' ? 'apprentice' : 'practice',
    difficulty: v.difficulty,
    chapter: count(v.chapter),
    page: count(v.page),
    ink: count(v.ink),
    score: count(v.score),
    correct: count(v.correct),
    errors: count(v.errors),
    destroyed: count(v.destroyed),
    bestCombo: count(v.bestCombo),
    playMs: count(v.playMs),
    charges: count(v.charges),
    eraser: v.eraser === true,
    shield: v.shield === true,
    savedAt: typeof v.savedAt === 'string' ? v.savedAt : new Date(0).toISOString(),
  };
}

function sanitizeVocab(v: unknown): VocabList[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((list): VocabList[] => {
    if (!isObject(list) || typeof list.id !== 'string' || typeof list.topic !== 'string') return [];
    const words = Array.isArray(list.words)
      ? [...new Set(list.words.filter((w): w is string => typeof w === 'string' && /^\p{Ll}{2,14}$/u.test(w.normalize('NFC'))))]
      : [];
    if (words.length === 0) return [];
    return [
      {
        id: list.id,
        lang: isLanguage(list.lang) ? list.lang : DEFAULT_LANGUAGE,
        topic: list.topic.slice(0, 40),
        words,
        enabled: list.enabled !== false,
        fetchedAt: typeof list.fetchedAt === 'string' ? list.fetchedAt : new Date(0).toISOString(),
      },
    ];
  });
}

function sanitizeApprentice(v: unknown): ApprenticeProgress {
  const a = isObject(v) ? v : {};
  const stars: Record<string, number> = {};
  if (isObject(a.stars)) {
    for (const [key, value] of Object.entries(a.stars)) {
      if (/^\d+-\d+$/.test(key) && typeof value === 'number' && value >= 1 && value <= 3) stars[key] = Math.floor(value);
    }
  }
  const accentStars: Partial<Record<Language, number[]>> = {};
  if (isObject(a.accentStars)) {
    for (const lang of LANGUAGES) {
      const list = a.accentStars[lang];
      // A chapter's best stars: up to 3 a page.
      if (Array.isArray(list)) accentStars[lang] = list.slice(0, 20).map((n) => Math.min(3 * GAME_CONFIG.accents.plan.length, count(n)));
    }
  }
  return {
    unlocked: Math.min(APPRENTICE_CHAPTERS, Math.max(1, count(a.unlocked) || 1)),
    stars,
    completed: a.completed === true,
    accentStars,
  };
}

function sanitizeProfile(v: unknown): Progression {
  const p = isObject(v) ? v : {};
  const c = isObject(p.cosmetics) ? p.cosmetics : {};
  const pick = <S extends keyof Cosmetics>(slot: S): Cosmetics[S] =>
    typeof c[slot] === 'string' && c[slot] in UNLOCKS[slot] ? (c[slot] as Cosmetics[S]) : DEFAULT_COSMETICS[slot];
  return { ink: count(p.ink), cosmetics: { nib: pick('nib'), splatter: pick('splatter'), paper: pick('paper'), hat: pick('hat') } };
}

/** Check every field of a current-version save. */
function sanitize(v: Json): SaveData {
  const base = defaultSave();
  const keys = chars(v.keys);

  const keyStats: Record<string, KeyStat> = {};
  if (isObject(v.keyStats)) {
    for (const [ch, stat] of Object.entries(v.keyStats)) {
      if (isChar(ch) && isObject(stat)) keyStats[ch] = { hits: count(stat.hits), misses: count(stat.misses) };
    }
  }

  const customPresets: SavedPreset[] = Array.isArray(v.customPresets)
    ? v.customPresets.flatMap((p): SavedPreset[] => {
        if (!isObject(p) || typeof p.id !== 'string' || typeof p.name !== 'string') return [];
        const presetChars = chars(p.chars);
        return presetChars.length > 0 ? [{ id: p.id, name: p.name.slice(0, 40), chars: presetChars }] : [];
      })
    : [];

  const records = isObject(v.records) ? v.records : {};

  return {
    version: SAVE_VERSION,
    keys: keys.length > 0 ? keys : base.keys,
    difficulty: isDifficulty(v.difficulty) ? v.difficulty : base.difficulty,
    customPresets,
    keyStats,
    records: {
      bestScore: difficultyRecord(records.bestScore),
      furthestChapter: difficultyRecord(records.furthestChapter),
      pageBest: sanitizePageBest(records.pageBest),
    },
    notebook: sanitizeNotebook(v.notebook),
    vocab: sanitizeVocab(v.vocab),
    apprentice: sanitizeApprentice(v.apprentice),
    profile: sanitizeProfile(v.profile),
    tutorials: sanitizeTutorials(v.tutorials),
    layout: isLayoutId(v.layout) ? v.layout : DEFAULT_LAYOUT_ID,
    daily: sanitizeDaily(v.daily),
    stickers: sanitizeStickers(v.stickers),
    nudges: sanitizeNudges(v.nudges),
    fairCopy: sanitizeFairCopy(v.fairCopy),
    wordsLanguage: isLanguage(v.wordsLanguage) ? v.wordsLanguage : DEFAULT_LANGUAGE,
    accents: sanitizeAccents(v.accents),
  };
}

function sanitizeAccents(v: unknown): AccentProgress {
  if (!isObject(v)) return { forgiving: false, seen: [] };
  return { forgiving: v.forgiving === true, seen: chars(v.seen) };
}

function sanitizeFairCopy(v: unknown): FairCopyProgress {
  const out: FairCopyProgress = { tests: 0, best: {}, copied: [] };
  if (!isObject(v)) return out;
  out.tests = count(v.tests);
  if (isObject(v.best)) {
    for (const [key, b] of Object.entries(v.best)) {
      if (!FAIR_COPY_KEYS.includes(key) || !isObject(b) || typeof b.at !== 'string') continue;
      const { wpm, accuracy } = b;
      if (typeof wpm !== 'number' || !Number.isFinite(wpm) || wpm < 0 || wpm > 1000) continue;
      if (typeof accuracy !== 'number' || !(accuracy >= 0 && accuracy <= 1)) continue;
      out.best[key] = { wpm, accuracy, at: b.at };
    }
  }
  if (Array.isArray(v.copied)) out.copied = [...new Set(v.copied.filter(isPassageId))];
  return out;
}

function sanitizeNudges(v: unknown): NudgeState {
  if (!isObject(v)) return { ...DEFAULT_NUDGES };
  return { off: v.off === true, wait: Math.min(99, count(v.wait)) };
}

function sanitizeStickers(v: unknown): StickerBook {
  const book: StickerBook = { earned: {}, unseen: [], bossesBeaten: [] };
  if (!isObject(v)) return book;
  if (isObject(v.earned)) {
    for (const [id, at] of Object.entries(v.earned)) if (isStickerId(id) && typeof at === 'string') book.earned[id] = at;
  }
  if (Array.isArray(v.unseen)) book.unseen = [...new Set(v.unseen.filter((id): id is string => isStickerId(id) && id in book.earned))];
  if (Array.isArray(v.bossesBeaten)) {
    book.bossesBeaten = [...new Set(v.bossesBeaten.filter((k): k is BossKind => BOSS_KINDS.includes(k as BossKind)))];
  }
  return book;
}

function sanitizePageBest(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObject(v)) return out;
  for (const [key, value] of Object.entries(v)) {
    if (/^(apprentice|practice):[a-z]+:\d+-\d+$/.test(key) && count(value) > 0) out[key] = count(value);
  }
  return out;
}

const GRADES: readonly Grade[] = ['A+', 'A', 'B', 'C', 'D', 'F'];

function sanitizeDaily(v: unknown): DailyProgress {
  if (!isObject(v)) return defaultDaily();
  const results: Record<string, DailyResult> = {};
  if (isObject(v.results)) {
    for (const [id, r] of Object.entries(v.results)) {
      if (!/^\d+$/.test(id) || !isObject(r)) continue;
      results[id] = {
        score: count(r.score),
        grades: Array.isArray(r.grades) ? r.grades.filter((g): g is Grade => GRADES.includes(g as Grade)) : [],
        wpm: count(r.wpm),
        accuracy: Math.min(100, count(r.accuracy)),
        finished: r.finished === true,
        ...(r.forgiving === true ? { forgiving: true as const } : {}),
      };
    }
  }
  const lastId = typeof v.lastId === 'number' && Number.isInteger(v.lastId) && v.lastId > 0 ? v.lastId : null;
  return { lastId, streak: count(v.streak), bestStreak: count(v.bestStreak), best: count(v.best), results };
}

function sanitizeTutorials(v: unknown): Tutorials {
  if (!isObject(v)) return { enabled: true, seen: [] };
  const seen = Array.isArray(v.seen) ? [...new Set(v.seen.filter(isMechanic))] : [];
  return { enabled: v.enabled !== false, seen };
}

/**
 * Mechanics that existed before version 7, with the first Apprentice chapter
 * (0-based) each appeared in. A player who had already finished that chapter
 * has met it, so the new briefings skip it.
 */
const MECHANICS_BEFORE_V7: Record<string, number> = {
  basics: 0,
  blotling: 0,
  combo: 0,
  blotter: 0,
  crimson: 4,
  spill: 6,
  ghost: 8,
  runon: 10,
  misprint: 15, // Misprints were removed in milestone 17; sanitizing drops the id.
  violet: 16,
};

function seenBeforeV7(save: Json): string[] {
  const unlocked = isObject(save.apprentice) ? count(save.apprentice.unlocked) : 1;
  // Chapters finished: one fewer than the chapters opened.
  const finished = Math.max(0, unlocked - 1);
  return Object.entries(MECHANICS_BEFORE_V7)
    .filter(([, chapter]) => finished > chapter)
    .map(([id]) => id);
}

/** Upgrade steps: MIGRATIONS[n] turns a version-n save into version n+1. */
const MIGRATIONS: Record<number, (save: Json) => Json> = {
  // v2 added downloaded topic word lists.
  1: (save) => ({ ...save, version: 2, vocab: [] }),
  // v3 added the Apprentice campaign; existing saved notebooks were Practice.
  2: (save) => ({
    ...save,
    version: 3,
    apprentice: { unlocked: 1, stars: {}, completed: false },
    notebook: isObject(save.notebook) ? { ...save.notebook, mode: 'practice' } : null,
  }),
  // v4 added ink (XP) and cosmetics.
  3: (save) => ({ ...save, version: 4, profile: { ink: 0, cosmetics: { ...DEFAULT_COSMETICS } } }),
  // v5 rebuilt the Apprentice course (one key per chapter), so its old
  // chapter progress and stars no longer line up: start it fresh.
  4: (save) => ({
    ...save,
    version: 5,
    apprentice: { unlocked: 1, stars: {}, completed: false },
    notebook: isObject(save.notebook) && save.notebook.mode === 'apprentice' ? null : save.notebook,
  }),
  // v6 added a per-player word filter level (dropped again in v11).
  5: (save) => ({ ...save, version: 6 }),
  // v7 added tutorials (players keep credit for what they'd already met) and
  // ability charges on a saved notebook.
  6: (save) => ({
    ...save,
    version: 7,
    tutorials: { enabled: true, seen: seenBeforeV7(save) },
    notebook: isObject(save.notebook) ? { ...save.notebook, charges: 0, eraser: false, shield: false } : null,
  }),
  // v8 added a keyboard layout per player; everyone so far typed on US QWERTY.
  7: (save) => ({ ...save, version: 8, layout: DEFAULT_LAYOUT_ID }),
  // v9 added best scores per page and the Daily Page.
  8: (save) => ({
    ...save,
    version: 9,
    records: { ...(isObject(save.records) ? save.records : {}), pageBest: {} },
    daily: defaultDaily(),
  }),
  // v10 added the sticker book; stickers for progress already made are given on the next check.
  9: (save) => ({ ...save, version: 10, stickers: { earned: {}, unseen: [], bossesBeaten: [] } }),
  // v11 dropped the per-player word filter level: everyone gets the family-friendly filter.
  10: (save) => {
    const next: Json = { ...save, version: 11 };
    delete next.contentLevel;
    return next;
  },
  // v12 added a hat for the Nib (holiday keepsakes); everyone starts without one.
  11: (save) => ({
    ...save,
    version: 12,
    profile: isObject(save.profile)
      ? { ...save.profile, cosmetics: { ...(isObject(save.profile.cosmetics) ? save.profile.cosmetics : {}), hat: 'none' } }
      : save.profile,
  }),
  // v13 added "Ready for more?" suggestions; nobody has answered one yet.
  12: (save) => ({ ...save, version: 13, nudges: { ...DEFAULT_NUDGES } }),
  // v14 added Fair Copy results; nobody has a best yet.
  13: (save) => ({ ...save, version: 14, fairCopy: { tests: 0, best: {} } }),
  // v15 remembers which Fair Copy passages were copied out; none so far, as nothing kept track before.
  14: (save) => ({ ...save, version: 15, fairCopy: { ...(isObject(save.fairCopy) ? save.fairCopy : {}), copied: [] } }),
  // v16 added a words language (everyone so far typed English), accent options and accent-chapter stars.
  15: (save) => ({
    ...save,
    version: 16,
    wordsLanguage: DEFAULT_LANGUAGE,
    accents: { forgiving: false, seen: [] },
    apprentice: { ...(isObject(save.apprentice) ? save.apprentice : {}), accentStars: {} },
  }),
};

/** Load any supported save shape as the current version, or throw SaveFormatError. */
export function migrate(raw: unknown): SaveData {
  if (!isObject(raw)) throw new SaveFormatError('Not a save file');
  let data = raw;
  let version = typeof data.version === 'number' ? data.version : NaN;
  if (!Number.isInteger(version) || version < 1) throw new SaveFormatError('Missing save version');
  if (version > SAVE_VERSION) throw new SaveFormatError(`Save version ${version} is newer than this game`, 'newer');

  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new SaveFormatError(`No migration from version ${version}`);
    data = step(data);
    version++;
  }
  return sanitize(data);
}

export function toExport(save: SaveData, now = new Date()): SaveExport {
  return { app: 'inkling', exportedAt: now.toISOString(), save };
}

/** Parse an exported file's text. Throws SaveFormatError if it isn't one. */
export function fromExport(text: string): SaveData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new SaveFormatError('Not valid JSON');
  }
  if (!isObject(parsed) || parsed.app !== 'inkling') throw new SaveFormatError('Not an Inky Keys save file');
  return migrate(parsed.save);
}
